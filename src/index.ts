import * as dotenv from 'dotenv'
import express, { Express, Request as ExpressRequest, Response, NextFunction, RequestHandler } from 'express'
import bodyParser from 'body-parser'
import { preAuth, postAuth } from './routes/index.js'
import { spawn } from 'child_process'
import { createServer } from 'http'
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { PublicKey } from '@bsv/sdk'
import { webcrypto } from 'crypto'
import knexLib from 'knex'
import knexConfig from '../knexfile.js'
import { Setup } from '@bsv/wallet-toolbox'
import sendMessageRoute from './routes/sendMessage.js'
import { Logger } from './utils/logger.js'
import { broadcastAdvertisement } from './utils/advertiserIntegration.js'
import overlayRoutes from './routes/overlayRoutes.js'

// Optional WebSocket import
import { AuthSocketServer } from '@bsv/authsocket'

(global as any).self = { crypto: webcrypto }

dotenv.config()

const app: Express = express()

const {
  NODE_ENV = 'development',
  PORT,
  SERVER_PRIVATE_KEY,
  ENABLE_WEBSOCKETS = 'true',
  ROUTING_PREFIX = '',
  WALLET_STORAGE_URL
} = process.env

if (NODE_ENV === 'development' || process.env.LOGGING_ENABLED === 'true') {
  Logger.enable()
}

const knex: knexLib.Knex = (knexLib as any).default?.(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
) ?? (knexLib as any)(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
)

export { knex }

// Ensure PORT is properly handled
const parsedPort = Number(PORT)
const parsedEnvPort = Number(process.env.HTTP_PORT)

const HTTP_PORT: number = NODE_ENV !== 'development'
  ? 3000
  : !isNaN(parsedPort) && parsedPort > 0
      ? parsedPort
      : !isNaN(parsedEnvPort) && parsedEnvPort > 0
          ? parsedEnvPort
          : 8080

// Initialize Wallet for Authentication
if (SERVER_PRIVATE_KEY === undefined || SERVER_PRIVATE_KEY === null || SERVER_PRIVATE_KEY.trim() === '') {
  throw new Error('SERVER_PRIVATE_KEY is not defined in the environment variables.')
}

// This allows the API to be used everywhere when CORS is enforced
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Expose-Headers', '*')
  res.header('Access-Control-Allow-Private-Network', 'true')

  if (req.method === 'OPTIONS') {
    // Handle CORS preflight requests to allow cross-origin POST/PUT requests
    res.sendStatus(200)
  } else {
    next()
  }
})

const wallet = await Setup.createWalletClientNoEnv({
  chain: 'main',
  rootKeyHex: SERVER_PRIVATE_KEY,
  storageUrl: WALLET_STORAGE_URL // https://storage.babbage.systems
})

export { wallet }

// Create HTTP server
/* eslint-disable @typescript-eslint/no-misused-promises */
const http = createServer(app)

// WebSocket setup (only if enabled)
let io: AuthSocketServer | null = null

if (ENABLE_WEBSOCKETS.toLowerCase() === 'true') {
  Logger.log('[WEBSOCKET] Initializing WebSocket support...')
  io = new AuthSocketServer(http, {
    wallet,
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  })

  // Map to store authenticated identity keys
  const authenticatedSockets = new Map<string, string>()

  io.on('connection', (socket) => {
    Logger.log('[WEBSOCKET] New connection established.')

    if (typeof socket.identityKey === 'string' && socket.identityKey.trim() !== '') {
      try {
        const parsedIdentityKey = PublicKey.fromString(socket.identityKey)
        Logger.log('[DEBUG] Parsed WebSocket Identity Key Successfully:', parsedIdentityKey.toString())

        authenticatedSockets.set(socket.id, parsedIdentityKey.toString())
        Logger.log('[WEBSOCKET] Identity key stored for socket ID:', socket.id)

        // Send confirmation immediately if identity key is provided on connection
        void socket.emit('authenticationSuccess', { status: 'success' })
      } catch (error) {
        Logger.error('[ERROR] Failed to parse WebSocket identity key:', error)
      }
    } else {
      Logger.warn('[WARN] WebSocket connection received without identity key. Waiting for authentication...')

      let identityKeyHandled = false

      const authListener = async (data: { identityKey?: string }): Promise<void> => {
        if (identityKeyHandled) return

        Logger.log('[WEBSOCKET] Received authentication data:', data)

        if (data !== null && data !== undefined && typeof data.identityKey === 'string' && data.identityKey.trim().length > 0) {
          try {
            const parsedIdentityKey = PublicKey.fromString(data.identityKey)
            Logger.log('[DEBUG] Retrieved and parsed Identity Key after connection:', parsedIdentityKey.toString())

            authenticatedSockets.set(socket.id, parsedIdentityKey.toString())
            Logger.log('[WEBSOCKET] Stored authenticated Identity Key for socket ID:', socket.id)

            identityKeyHandled = true

            Logger.log(`New authenticated WebSocket connection from: ${authenticatedSockets.get(socket.id) ?? 'unknown'}`)

            // Emit authentication success message
            await socket.emit('authenticationSuccess', { status: 'success' }).catch(error => {
              Logger.error('[WEBSOCKET ERROR] Failed to send authentication success event:', error)
            })
          } catch (error) {
            Logger.error('[ERROR] Failed to parse Identity Key from authenticated event:', error)
            await socket.emit('authenticationFailed', { reason: 'Invalid identity key format' })
          }
        } else {
          Logger.warn('[WARN] Invalid or missing identity key in authentication event.')
          await socket.emit('authenticationFailed', { reason: 'Missing identity key' })
        }
      }

      // Ensure `authListener` is used properly
      socket.on('authenticated', authListener)
    }

    // Re-adding Send Message Handling
    socket.on(
      'sendMessage',
      async (data: { roomId: string, message: { messageId: string, recipient: string, body: string } }): Promise<void> => {
        if (typeof data !== 'object' || data == null) {
          Logger.error('[WEBSOCKET ERROR] Invalid data object received.')
          await socket.emit('messageFailed', { reason: 'Invalid data object' })
          return
        }

        const { roomId, message } = data

        if (!authenticatedSockets.has(socket.id)) {
          Logger.warn('[WEBSOCKET] Unauthorized attempt to send a message.')
          await socket.emit('paymentFailed', { reason: 'Unauthorized: WebSocket not authenticated' })
          return
        }

        Logger.log(`[WEBSOCKET] Processing sendMessage for room: ${roomId}`)

        try {
          if (typeof roomId !== 'string' || roomId.trim() === '') {
            Logger.error('[WEBSOCKET ERROR] Invalid roomId:', roomId)
            await socket.emit('messageFailed', { reason: 'Invalid room ID' })
            return
          }

          if (typeof message !== 'object' || message == null) {
            Logger.error('[WEBSOCKET ERROR] Invalid message object:', message)
            await socket.emit('messageFailed', { reason: 'Invalid message object' })
            return
          }

          if (typeof message.body !== 'string' || message.body.trim() === '') {
            Logger.error('[WEBSOCKET ERROR] Invalid message body:', message.body)
            await socket.emit('messageFailed', { reason: 'Invalid message body' })
            return
          }

          Logger.log(`[WEBSOCKET] Acknowledging message ${message.messageId} to sender.`)

          const ackPayload = {
            status: 'success',
            messageId: message.messageId
          }

          Logger.log(`[WEBSOCKET] Emitting ack event: sendMessageAck-${roomId}`)

          socket.emit(`sendMessageAck-${roomId}`, ackPayload).catch((error) => {
            Logger.error(`[WEBSOCKET ERROR] Failed to emit sendMessageAck-${roomId}:`, error)
          })

          // Store message in the database just like HTTP sendMessage route
          try {
            const parts = roomId.split('-')
            const messageBoxType = parts.length > 1 ? parts[1] : 'default'

            Logger.log(`[WEBSOCKET] Parsed messageBoxType: ${messageBoxType}`)
            Logger.log(`[WEBSOCKET] Attempting to store message for recipient: ${message.recipient}, box type: ${messageBoxType}`)

            let messageBox = await knex('messageBox')
              .where({ identityKey: message.recipient, type: messageBoxType })
              .first()

            if (messageBox === null || messageBox === undefined) {
              Logger.log('[WEBSOCKET] messageBox not found. Creating new messageBox.')
              await knex('messageBox').insert({
                identityKey: message.recipient,
                type: messageBoxType,
                created_at: new Date(),
                updated_at: new Date()
              })
            }

            messageBox = await knex('messageBox')
              .where({ identityKey: message.recipient, type: messageBoxType })
              .select('messageBoxId')
              .first()

            const messageBoxId = messageBox?.messageBoxId ?? null

            if (messageBoxId === null || messageBoxId === undefined) {
              Logger.warn('[WEBSOCKET WARNING] messageBoxId is null — message may not be stored correctly!')
            } else {
              Logger.log(`[WEBSOCKET] Resolved messageBoxId: ${String(messageBoxId)}`)
            }

            const senderKey = authenticatedSockets.get(socket.id) ?? null

            const insertResult = await knex('messages')
              .insert({
                messageId: message.messageId,
                messageBoxId,
                sender: senderKey,
                recipient: message.recipient,
                body: message.body,
                created_at: new Date(),
                updated_at: new Date()
              })
              .onConflict('messageId')
              .ignore()

            if (insertResult.length === 0) {
              Logger.warn('[WEBSOCKET WARNING] Message insert was ignored due to conflict (duplicate messageId?)')
            } else {
              Logger.log('[WEBSOCKET] Message successfully stored in DB.')
            }
          } catch (dbError) {
            Logger.error('[WEBSOCKET ERROR] Failed to store message in DB:', dbError)
            await socket.emit('messageFailed', { reason: 'Failed to store message' })
            return
          }

          if (io != null) {
            Logger.log(`[WEBSOCKET] Emitting message to room ${roomId}`)
            io.emit(`sendMessage-${roomId}`, {
              sender: authenticatedSockets.get(socket.id),
              messageId: message.messageId,
              body: message.body
            })
          } else {
            Logger.error('[WEBSOCKET ERROR] io is null, cannot emit message.')
          }
        } catch (error) {
          Logger.error('[WEBSOCKET ERROR] Unexpected failure in sendMessage handler:', error)
          await socket.emit('messageFailed', { reason: 'Unexpected error occurred' })
        }
      }
    )

    // Re-adding Join Room Handling
    socket.on('joinRoom', async (roomId: string) => {
      if (!authenticatedSockets.has(socket.id)) {
        Logger.warn('[WEBSOCKET] Unauthorized attempt to join a room.')
        await socket.emit('joinFailed', { reason: 'Unauthorized: WebSocket not authenticated' })
        return
      }

      if (roomId == null || typeof roomId !== 'string' || roomId.trim() === '') {
        Logger.error('[WEBSOCKET ERROR] Invalid roomId:', roomId)
        await socket.emit('joinFailed', { reason: 'Invalid room ID' })
        return
      }

      Logger.log(`[WEBSOCKET] User ${socket.id} joined room ${roomId}`)
      await socket.emit('joinedRoom', { roomId })
    })

    // Re-adding Leave Room Handling
    socket.on('leaveRoom', async (roomId: string) => {
      if (!authenticatedSockets.has(socket.id)) {
        Logger.warn('[WEBSOCKET] Unauthorized attempt to leave a room.')
        await socket.emit('leaveFailed', { reason: 'Unauthorized: WebSocket not authenticated' })
        return
      }

      if (roomId == null || roomId === '' || typeof roomId !== 'string' || roomId.trim() === '') {
        Logger.error('[WEBSOCKET ERROR] Invalid roomId:', roomId)
        await socket.emit('leaveFailed', { reason: 'Invalid room ID' })
        return
      }

      Logger.log(`[WEBSOCKET] User ${socket.id} left room ${roomId}`)
      await socket.emit('leftRoom', { roomId })
    })

    socket.on('disconnect', (reason: string) => {
      Logger.log(`[WEBSOCKET] Disconnected: ${reason}`)
      authenticatedSockets.delete(socket.id)
    })
  })
}

// Configure JSON body parser
app.use(bodyParser.json({ limit: '1gb', type: 'application/json' }))

export { io, http, HTTP_PORT, ROUTING_PREFIX }

// Define Authenticated Request Type
interface AuthenticatedRequest extends ExpressRequest {
  auth?: { identityKey: string }
}

// Log authentication **before** running auth middleware
app.use((req: ExpressRequest, res: Response, next: NextFunction): void => {
  Logger.log('[DEBUG] Incoming Request:', req.method, req.url)
  Logger.log('[DEBUG] Request Headers:', JSON.stringify(req.headers, null, 2))
  Logger.log('[DEBUG] Request Body:', JSON.stringify(req.body, null, 2))

  if (req.headers['x-bsv-auth-identity-key'] == null) {
    Logger.warn('[WARNING] Missing x-bsv-auth-identity-key in headers')
  }

  next()
})

const authMiddleware = createAuthMiddleware({
  wallet,
  allowUnauthenticated: false,
  logger: console,
  logLevel: 'debug'
})

// Serve Static Files
app.use(express.static('public'))

// Pre-Auth Routes
preAuth.forEach((route) => {
  app[route.type as 'get' | 'post' | 'put' | 'delete'](
    `${String(ROUTING_PREFIX)}${String(route.path)}`,
    route.func as unknown as (req: ExpressRequest, res: Response, next: NextFunction) => void
  )
})

// Apply authentication middleware
app.use(authMiddleware)

// Log authentication **after** auth middleware runs
app.use((req: ExpressRequest, res: Response, next: NextFunction): void => {
  const authRequest = req as unknown as AuthenticatedRequest
  Logger.log('[DEBUG] After Authentication Middleware:', req.url)
  Logger.log('[DEBUG] Authenticated User Identity:', authRequest.auth?.identityKey ?? 'Not Provided')

  if (authRequest.auth?.identityKey == null) {
    Logger.warn('[WARNING] AuthMiddleware did not set req.auth correctly!')
  } else {
    Logger.log('[DEBUG] Authentication Successful:', authRequest.auth.identityKey)
  }

  next()
})

// const paymentMiddleware = createPaymentMiddleware({
//   wallet,
//   calculateRequestPrice: async (req) => {
//     Logger.log('[DEBUG] Payment Middleware Triggered')

//     const body = req.body as { message?: { body: string }, priority?: boolean }

//     if (body.message?.body == null) {
//       Logger.warn('[WARNING] No message body provided, skipping payment calculation.')
//       return 0
//     }

//     const price = calculateMessagePrice(body.message.body, body.priority ?? false)
//     Logger.log(`[DEBUG] Calculated payment requirement: ${price} satoshis`)
//     return price
//   }
// })

// Post-Auth Routes
postAuth.forEach((route) => {
  const loggingMiddleware: RequestHandler = (req, res, next) => {
    Logger.log('[DEBUG] Authenticated Request to:', req.url)
    Logger.log('[DEBUG] User Identity:', req.body.identityKey ?? 'Not Provided')
    next()
  }

  if (route.path === '/sendMessage') {
    app[route.type as 'get' | 'post' | 'put' | 'delete'](
      `${String(ROUTING_PREFIX)}${String(route.path)}`,
      loggingMiddleware,
      // paymentMiddleware, // Apply payment middleware specifically for /sendMessage
      sendMessageRoute.func as unknown as RequestHandler
    )
  } else {
    app[route.type as 'get' | 'post' | 'put' | 'delete'](
      `${String(ROUTING_PREFIX)}${String(route.path)}`,
      loggingMiddleware,
      route.func as RequestHandler
    )
  }
})

app.use('/overlay', overlayRoutes)

// 404 Route Not Found Handler
app.use((req: ExpressRequest, res: Response) => {
  Logger.log('404', req.url)
  res.status(404).json({
    status: 'error',
    code: 'ERR_ROUTE_NOT_FOUND',
    description: 'Route not found.'
  })
})

// Start API Server
http.listen(HTTP_PORT, () => {
  Logger.log('MessageBox listening on port', HTTP_PORT)
  if (NODE_ENV !== 'development' && process.env.SKIP_NGINX !== 'true') {
    spawn('nginx', [], { stdio: ['inherit', 'inherit', 'inherit'] })
  }

  (async () => {
    await delay(8000)
    await knex.migrate.latest()

    try {
      Logger.log('[ADVERTISER] Broadcasting advertisement on startup...')
      const result = await broadcastAdvertisement({
        host: process.env.ADVERTISEMENT_HOST ?? `http://localhost:${HTTP_PORT}`,
        identityKey: wallet.getPublicKey != null ? (await wallet.getPublicKey({ identityKey: true })).publicKey : '',
        privateKey: SERVER_PRIVATE_KEY,
        wallet
      })
      Logger.log('[ADVERTISER] Broadcast result:', result)
    } catch (error) {
      Logger.error('[ADVERTISER ERROR] Failed to broadcast on startup:', error)
    }

    // Optional: Periodic rebroadcast every 5 minutes
    // setInterval(async () => {
    //   try {
    //     Logger.log('[ADVERTISER] Periodic rebroadcast starting...')
    //     const rebroadcast = await broadcastAdvertisement({
    //       host: process.env.ADVERTISEMENT_HOST ?? `http://localhost:${HTTP_PORT}`,
    //       identityKey: (await wallet.getPublicKey({ identityKey: true })).publicKey,
    //       privateKey: SERVER_PRIVATE_KEY,
    //       wallet
    //     })
    //     Logger.log('[ADVERTISER] Periodic rebroadcast result:', rebroadcast)
    //   } catch (error) {
    //     Logger.error('[ADVERTISER ERROR] Periodic rebroadcast failed:', error)
    //   }
    // }, 5 * 60 * 1000) // 5 minutes
  })().catch((error) => { Logger.error(error) })
})

const delay = async (ms: number): Promise<void> =>
  await new Promise(resolve => setTimeout(resolve, ms))

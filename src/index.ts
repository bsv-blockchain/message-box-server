import * as dotenv from 'dotenv'
import express, { Express, Request as ExpressRequest, Response, NextFunction, RequestHandler } from 'express'
import bodyParser from 'body-parser'
import { preAuth, postAuth } from './routes/index.js'
import { spawn } from 'child_process'
import { createServer } from 'http'
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { PrivateKey, PublicKey } from '@bsv/sdk'
import { webcrypto } from 'crypto'
import knexLib from 'knex'
import knexConfig from '../knexfile.js'
import { Setup } from '@bsv/wallet-toolbox'
import { createPaymentMiddleware } from '@bsv/payment-express-middleware'
import sendMessageRoute, { calculateMessagePrice } from './routes/sendMessage.js'

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
  STORAGE_URL
} = process.env

const knex: knexLib.Knex = (knexLib as any).default?.(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
) ?? (knexLib as any)(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
)

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

const privateKey = PrivateKey.fromRandom()
console.log('[DEBUG] Generated Private Key:', privateKey.toHex())

const wallet = await Setup.createWalletClientNoEnv({
  chain: 'main',
  rootKeyHex: SERVER_PRIVATE_KEY,
  storageUrl: STORAGE_URL // https://storage.babbage.systems
})

// Check the derived public key
const publicKey = privateKey.toPublicKey()
console.log('[DEBUG] Derived Public Key:', publicKey.toString())

// Create HTTP server
/* eslint-disable @typescript-eslint/no-misused-promises */
const http = createServer(app)

// WebSocket setup (only if enabled)
let io: AuthSocketServer | null = null

if (ENABLE_WEBSOCKETS.toLowerCase() === 'true') {
  console.log('[WEBSOCKET] Initializing WebSocket support...')
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
    console.log('[WEBSOCKET] New connection established.')

    if (typeof socket.identityKey === 'string' && socket.identityKey.trim() !== '') {
      try {
        const parsedIdentityKey = PublicKey.fromString(socket.identityKey)
        console.log('[DEBUG] Parsed WebSocket Identity Key Successfully:', parsedIdentityKey.toString())

        authenticatedSockets.set(socket.id, parsedIdentityKey.toString())
        console.log('[WEBSOCKET] Identity key stored for socket ID:', socket.id)

        // Send confirmation immediately if identity key is provided on connection
        void socket.emit('authenticationSuccess', { status: 'success' })
      } catch (error) {
        console.error('[ERROR] Failed to parse WebSocket identity key:', error)
      }
    } else {
      console.warn('[WARN] WebSocket connection received without identity key. Waiting for authentication...')

      let identityKeyHandled = false

      const authListener = async (data: { identityKey?: string }): Promise<void> => {
        if (identityKeyHandled) return

        console.log('[WEBSOCKET] Received authentication data:', data)

        if (data !== null && data !== undefined && typeof data.identityKey === 'string' && data.identityKey.trim().length > 0) {
          try {
            const parsedIdentityKey = PublicKey.fromString(data.identityKey)
            console.log('[DEBUG] Retrieved and parsed Identity Key after connection:', parsedIdentityKey.toString())

            authenticatedSockets.set(socket.id, parsedIdentityKey.toString())
            console.log('[WEBSOCKET] Stored authenticated Identity Key for socket ID:', socket.id)

            identityKeyHandled = true

            console.log(`New authenticated WebSocket connection from: ${authenticatedSockets.get(socket.id) ?? 'unknown'}`)

            // Emit authentication success message
            await socket.emit('authenticationSuccess', { status: 'success' }).catch(error => {
              console.error('[WEBSOCKET ERROR] Failed to send authentication success event:', error)
            })
          } catch (error) {
            console.error('[ERROR] Failed to parse Identity Key from authenticated event:', error)
            await socket.emit('authenticationFailed', { reason: 'Invalid identity key format' })
          }
        } else {
          console.warn('[WARN] Invalid or missing identity key in authentication event.')
          await socket.emit('authenticationFailed', { reason: 'Missing identity key' })
        }
      }

      // Ensure `authListener` is used properly
      socket.on('authenticated', authListener)
    }

    // Re-adding Send Message Handling
    socket.on('sendMessage', async ({ roomId, message }) => {
      if (!authenticatedSockets.has(socket.id)) {
        console.warn('[WEBSOCKET] Unauthorized attempt to send a message.')
        await socket.emit('paymentFailed', { reason: 'Unauthorized: WebSocket not authenticated' })
        return
      }

      console.log(`[WEBSOCKET] Processing sendMessage for room: ${String(roomId)}`)

      try {
        if (roomId == null || typeof roomId !== 'string' || roomId.trim() === '') {
          console.error('[WEBSOCKET ERROR] Invalid roomId:', roomId)
          await socket.emit('messageFailed', { reason: 'Invalid room ID' })
          return
        }

        if (message == null || typeof message.body !== 'string' || message.body.trim() === '') {
          console.error('[WEBSOCKET ERROR] Invalid message body:', message?.body)
          await socket.emit('messageFailed', { reason: 'Invalid message body' })
          return
        }

        console.log(`[WEBSOCKET] Broadcasting message to room ${roomId}`)
        if (io !== null) {
          io.emit(`sendMessage-${roomId}`, {
            sender: authenticatedSockets.get(socket.id) ?? 'unknown',
            ...message
          })
        } else {
          console.error('[WEBSOCKET ERROR] WebSocket server is not initialized.')
        }
      } catch (error) {
        console.error('[WEBSOCKET ERROR] Failed to send message:', error)
        await socket.emit('messageFailed', { reason: 'Message processing error' })
      }
    })

    // Re-adding Join Room Handling
    socket.on('joinRoom', async (roomId: string) => {
      if (!authenticatedSockets.has(socket.id)) {
        console.warn('[WEBSOCKET] Unauthorized attempt to join a room.')
        await socket.emit('joinFailed', { reason: 'Unauthorized: WebSocket not authenticated' })
        return
      }

      if (roomId == null || typeof roomId !== 'string' || roomId.trim() === '') {
        console.error('[WEBSOCKET ERROR] Invalid roomId:', roomId)
        await socket.emit('joinFailed', { reason: 'Invalid room ID' })
        return
      }

      console.log(`[WEBSOCKET] User ${socket.id} joined room ${roomId}`)
      await socket.emit('joinedRoom', { roomId })
    })

    // Re-adding Leave Room Handling
    socket.on('leaveRoom', async (roomId: string) => {
      if (!authenticatedSockets.has(socket.id)) {
        console.warn('[WEBSOCKET] Unauthorized attempt to leave a room.')
        await socket.emit('leaveFailed', { reason: 'Unauthorized: WebSocket not authenticated' })
        return
      }

      if (roomId == null || roomId === '' || typeof roomId !== 'string' || roomId.trim() === '') {
        console.error('[WEBSOCKET ERROR] Invalid roomId:', roomId)
        await socket.emit('leaveFailed', { reason: 'Invalid room ID' })
        return
      }

      console.log(`[WEBSOCKET] User ${socket.id} left room ${roomId}`)
      await socket.emit('leftRoom', { roomId })
    })

    socket.on('disconnect', (reason: string) => {
      console.log(`[WEBSOCKET] Disconnected: ${reason}`)
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
  console.log('[DEBUG] Incoming Request:', req.method, req.url)
  console.log('[DEBUG] Request Headers:', JSON.stringify(req.headers, null, 2))
  console.log('[DEBUG] Request Body:', JSON.stringify(req.body, null, 2))

  if (req.headers['x-bsv-auth-identity-key'] == null) {
    console.warn('[WARNING] Missing x-bsv-auth-identity-key in headers')
  }

  next()
})

let authMiddlewareCounter = 0

const authMiddleware = createAuthMiddleware({
  wallet,
  allowUnauthenticated: false
})

// Track auth middleware executions
app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
  authMiddlewareCounter++
  console.log(`[DEBUG] AuthMiddleware Executed (${authMiddlewareCounter} times) for: ${req.url}`)
  next()
})

// Apply authentication middleware
app.use(authMiddleware)

// Log authentication **after** auth middleware runs
app.use((req: ExpressRequest, res: Response, next: NextFunction): void => {
  const authRequest = req as unknown as AuthenticatedRequest
  console.log('[DEBUG] After Authentication Middleware:', req.url)
  console.log('[DEBUG] Authenticated User Identity:', authRequest.auth?.identityKey ?? 'Not Provided')

  if (authRequest.auth?.identityKey == null) {
    console.warn('[WARNING] AuthMiddleware did not set req.auth correctly!')
  } else {
    console.log('[DEBUG] Authentication Successful:', authRequest.auth.identityKey)
  }

  next()
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

const paymentMiddleware = createPaymentMiddleware({
  wallet,
  calculateRequestPrice: async (req) => {
    console.log('[DEBUG] Payment Middleware Triggered')

    const body = req.body as { message?: { body: string }, priority?: boolean }

    if (body.message?.body == null) {
      console.warn('[WARNING] No message body provided, skipping payment calculation.')
      return 0
    }

    const price = calculateMessagePrice(body.message.body, body.priority ?? false)
    console.log(`[DEBUG] Calculated payment requirement: ${price} satoshis`)
    return price
  }
})

// Post-Auth Routes
postAuth.forEach((route) => {
  const loggingMiddleware: RequestHandler = (req, res, next) => {
    console.log('[DEBUG] Authenticated Request to:', req.url)
    console.log('[DEBUG] User Identity:', req.body.identityKey ?? 'Not Provided')
    next()
  }

  if (route.path === '/sendMessage') {
    app[route.type as 'get' | 'post' | 'put' | 'delete'](
      `${String(ROUTING_PREFIX)}${String(route.path)}`,
      loggingMiddleware,
      paymentMiddleware, // Apply payment middleware specifically for /sendMessage
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

// 404 Route Not Found Handler
app.use((req: ExpressRequest, res: Response) => {
  console.log('404', req.url)
  res.status(404).json({
    status: 'error',
    code: 'ERR_ROUTE_NOT_FOUND',
    description: 'Route not found.'
  })
})

// Start API Server
http.listen(HTTP_PORT, () => {
  console.log('MessageBox listening on port', HTTP_PORT)
  if (NODE_ENV !== 'development' && process.env.SKIP_NGINX !== 'true') {
    spawn('nginx', [], { stdio: ['inherit', 'inherit', 'inherit'] })
  }

  (async () => {
    await delay(5000)
    await knex.migrate.latest()
  })().catch((error) => { console.error(error) })
})

const delay = async (ms: number): Promise<void> =>
  await new Promise(resolve => setTimeout(resolve, ms))

import * as dotenv from 'dotenv'
import express, { Express, Request, Response, NextFunction } from 'express'
import bodyParser from 'body-parser'
import { preAuth, postAuth } from './routes/index.js'
import { spawn } from 'child_process'
import { createServer } from 'http'
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { ProtoWallet, PrivateKey, PublicKey } from '@bsv/sdk'
import { webcrypto } from 'crypto'
import knexLib from 'knex'
import knexConfig from '../knexfile.js'

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  HOSTING_DOMAIN,
  ROUTING_PREFIX = ''
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

const wallet = new ProtoWallet(privateKey)

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

  io.on('connection', (socket) => {
    console.log('[WEBSOCKET] Raw identityKey received:', socket.identityKey)

    try {
      if (typeof socket.identityKey === 'string' && socket.identityKey.trim() !== '') {
        const parsedIdentityKey = PublicKey.fromString(socket.identityKey)
        console.log('[DEBUG] Parsed WebSocket Identity Key Successfully:', parsedIdentityKey.toString())
      } else {
        console.warn('[WARN] WebSocket connection received without identity key.')
      }
    } catch (error) {
      console.error('[ERROR] Failed to parse WebSocket identity key:', error)
    }

    const identityKey = socket.identityKey ?? 'unknown'
    console.log(`New authenticated WebSocket connection from: ${identityKey}`)

    socket.on('disconnect', (reason: string) => {
      console.log(`Disconnected: ${reason}`)
    })

    socket.on('reconnect', (attemptNumber: number) => {
      console.log(`Reconnected after ${attemptNumber} attempts`)
    })

    socket.on('reconnect_error', (error: Error) => {
      console.log('Reconnection failed:', error)
    })
  })
}

// Configure JSON body parser
app.use(bodyParser.json({ limit: '1gb', type: 'application/json' }))

export { io, http, HTTP_PORT, ROUTING_PREFIX }

const authMiddleware = createAuthMiddleware({
  wallet,
  allowUnauthenticated: false
})

// Debug logs before auth middleware runs
app.use((req: Request, res: Response, next: NextFunction): void => {
  console.log('[DEBUG] Incoming Auth Request:', req.method, req.url)

  if (req.headers != null) {
    console.log('[DEBUG] Request Headers:', JSON.stringify(req.headers, null, 2))

    if (req.headers['x-bsv-auth-identity-key'] === undefined) {
      console.warn('[WARNING] Missing x-bsv-auth-identity-key in headers')
    }
  } else {
    console.warn('[WARNING] Headers object is null or undefined')
  }

  if (req.body != null && typeof req.body === 'object') {
    console.log('[DEBUG] Request Body:', JSON.stringify(req.body, null, 2))

    if (typeof req.body.identityKey === 'string' && req.body.identityKey.trim() !== '') {
      console.log(`[DEBUG] Received identityKey: ${String(req.body.identityKey)}`)

      try {
        const parsedPublicKey = PublicKey.fromString(req.body.identityKey)
        console.log('[DEBUG] Parsed Public Key Successfully:', parsedPublicKey.toString())
      } catch (error) {
        console.error('[ERROR] Failed to parse identityKey:', error)
      }
    } else {
      console.warn('[WARNING] Invalid or missing identityKey in request body')
    }
  } else {
    console.warn('[WARNING] Request body is null, undefined, or not an object')
  }

  next()
})

// Debug logs after auth middleware runs
app.use((req: Request, res: Response, next: NextFunction): void => {
  console.log('[DEBUG] After Authentication Middleware:', req.url)

  if (req.body != null && typeof req.body === 'object') {
    console.log('[DEBUG] Authenticated User Identity:', req.body.identityKey ?? 'Not Provided')
  } else {
    console.warn('[WARNING] Authenticated request body is null, undefined, or not an object')
  }

  next()
})

// Serve Static Files
app.use(express.static('public'))

// Pre-Auth Routes
preAuth.forEach((route) => {
  app[route.type as 'get' | 'post' | 'put' | 'delete'](
    `${String(ROUTING_PREFIX)}${String(route.path)}`,
    route.func as unknown as (req: Request, res: Response, next: NextFunction) => void
  )
})

// Apply New Authentication Middleware
app.use(authMiddleware)

// Post-Auth Routes
postAuth.forEach((route) => {
  app[route.type as 'get' | 'post' | 'put' | 'delete'](
    `${String(ROUTING_PREFIX)}${String(route.path)}`,
    (req, res, next) => {
      console.log('[DEBUG] Authenticated Request to:', req.url)
      console.log('[DEBUG] User Identity:', req.body.identityKey ?? 'Not Provided')
      next()
    },
    route.func as unknown as (req: Request, res: Response, next: NextFunction) => void
  )
})

// 404 Route Not Found Handler
app.use((req: Request, res: Response) => {
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

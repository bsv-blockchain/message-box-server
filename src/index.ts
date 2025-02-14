import * as dotenv from 'dotenv'
import express, { Express, Request, Response, NextFunction } from 'express'
import bodyParser from 'body-parser'
import prettyjson from 'prettyjson'
import { preAuthrite, postAuthrite } from './routes/index.js'
import { spawn } from 'child_process'
import { createServer } from 'http'
import { AuthSocketServer } from '@bsv/authsocket'
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { WalletClient, SessionManager } from '@bsv/sdk'

dotenv.config()

const app: Express = express()

const {
  NODE_ENV = 'development',
  PORT,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SERVER_PRIVATE_KEY,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  HOSTING_DOMAIN,
  ROUTING_PREFIX = ''
} = process.env

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
const wallet = new WalletClient() // Replace with your actual Wallet instance setup
const sessionManager = new SessionManager()

// Create HTTP server
const http = createServer((req, res) => {
  app(req, res).catch((err) => {
    console.error('Unhandled server error:', err)
    res.statusCode = 500
    res.end('Internal Server Error')
  })
})

const io = new AuthSocketServer(http, {
  wallet, // Required for signing
  sessionManager, // Manages authentication sessions
  cors: {
    origin: '*', // Allows all origins for WebSockets
    methods: ['GET', 'POST']
  }
})

// Configure JSON body parser
app.use(bodyParser.json({ limit: '1gb', type: 'application/json' }))

export { io, http, HTTP_PORT, ROUTING_PREFIX }

// Initialize Auth Middleware
const authMiddleware = createAuthMiddleware({
  wallet // Wallet must be passed to enable authentication
})

// Force HTTPS unless in development mode
app.use((req: Request, res: Response, next: NextFunction) => {
  const forwardedProto: string = req.get('x-forwarded-proto') ?? ''
  const isSecure: boolean = (req as any).secure === true
  const host: string = req.get('host') ?? ''

  if (!isSecure && forwardedProto !== 'https' && NODE_ENV !== 'development') {
    return res.redirect(`https://${host}${String(req.url)}`)
  }
  next()
})

// CORS Configuration
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Expose-Headers', '*')
  res.header('Access-Control-Allow-Private-Network', 'true')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Configure WebSocket Events (Now Using @bsv/authsocket)
io.on('connection', (socket) => {
  const identityKey = socket.identityKey ?? 'unknown'
  console.log(`New authenticated WebSocket connection from: ${identityKey}`)

  socket.on('joinPrivateRoom', (roomId: string) => {
    void (async () => {
      try {
        await socket.ioSocket.join(roomId)
        console.log(`User joined private room: ${roomId}`)
      } catch (error) {
        console.error(`Failed to join private room: ${roomId}`, error)
      }
    })()
  })

  socket.on('joinRoom', (roomId: string) => {
    void (async () => {
      if (socket.identityKey != null && roomId.startsWith(socket.identityKey)) {
        try {
          await socket.ioSocket.join(roomId) // ✅ Correct method for joining rooms
          console.log(`User joined room: ${roomId}`)
        } catch (error) {
          console.error(`Failed to join room: ${roomId}`, error)
        }
      } else {
        console.warn(`Unauthorized room join attempt by: ${socket.identityKey ?? 'unknown'}`)
      }
    })()
  })

  socket.on('leaveRoom', (roomId: string) => {
    void (async () => {
      try {
        await socket.ioSocket.leave(roomId) // ✅ Correct method for leaving rooms
        console.log(`User left room: ${roomId}`)
      } catch (error) {
        console.error(`Failed to leave room: ${roomId}`, error)
      }
    })()
  })

  socket.on('sendMessage', ({ roomId, message }: { roomId: string, message: any }) => {
    if (socket.identityKey === null || socket.identityKey === undefined) {
      console.warn('Unauthorized message attempt from unidentified socket.')
      return
    }

    const dataToSend = {
      sender: socket.identityKey,
      message: typeof message === 'object' && Object.keys(message).length !== 0 ? message : String(message)
    }

    socket.ioSocket.broadcast.to(roomId).emit(`sendMessage-${roomId}`, dataToSend)
  })

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

// Logger Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${req.method}] <- ${req.url}`)
  console.log(prettyjson.render(req.body, { keysColor: 'blue' }))

  const originalJson = res.json.bind(res)

  res.json = (json: any): Response => {
    originalJson(json)
    console.log(`[${req.method}] -> ${req.url}`)
    console.log(prettyjson.render(json, { keysColor: 'green' }))
    return res
  }

  next()
})

// Serve Static Files
app.use(express.static('public'))

// Pre-Auth Routes (Handled as before)
preAuthrite.forEach((route) => {
  app[route.type as 'get' | 'post' | 'put' | 'delete'](`${String(ROUTING_PREFIX)}${String(route.path)}`, route.func)
})

// Apply New Authentication Middleware
app.use(authMiddleware)

// Post-Auth Routes
postAuthrite.forEach((route) => {
  app[route.type as 'get' | 'post' | 'put' | 'delete'](`${String(ROUTING_PREFIX)}${String(route.path)}`, route.func)
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
  if (NODE_ENV !== 'development') {
    spawn('nginx', [], { stdio: ['inherit', 'inherit', 'inherit'] })
  }
})

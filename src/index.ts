import * as dotenv from 'dotenv'
import express, { Express, Request, Response, NextFunction } from 'express'
import bodyParser from 'body-parser'
import prettyjson from 'prettyjson'
import { preAuthrite, postAuthrite } from './routes'
import authrite from 'authrite-express'
import { spawn } from 'child_process'
import { createServer } from 'http'
import { Socket } from 'socket.io'

dotenv.config()

const app: Express = express()

const {
  NODE_ENV = 'development',
  PORT,
  SERVER_PRIVATE_KEY,
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

// Create HTTP server
const http = createServer((req, res) => app(req, res))

// Ensure `serverPrivateKey` is only set if it exists
const io = authrite.socket(http, {
  cors: {
    origin: '*'
  },
  serverPrivateKey: SERVER_PRIVATE_KEY ?? '' // Ensuring it never gets undefined
})

// Configure JSON body parser
app.use(bodyParser.json({ limit: '1gb', type: 'application/json' }))

export { io, http, HTTP_PORT, ROUTING_PREFIX }

// Force HTTPS unless in development mode
// Ensure HTTPS is used unless in development mode
app.use((req: Request, res: Response, next: NextFunction) => {
  const forwardedProto: string = req.get('x-forwarded-proto') ?? ''
  const isSecure: boolean = (req as any).secure === true // Ensure req.secure exists
  const host: string = req.get('host') ?? '' // Ensure host is a string

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

// Configure WebSocket Events
io.on('connection', (socket: Socket) => {
  console.log('A user connected')

  // Support private rooms
  socket.on('joinPrivateRoom', async (roomId: string) => {
    try {
      await socket.join(roomId) // Ensures the promise is properly handled
      console.log('User joined private room')
    } catch (error) {
      console.error(`Failed to join private room: ${roomId}`, error)
    }
  })

  // Joining a room
  socket.on('joinRoom', async (roomId: string) => {
    const identityKeyRaw = socket.handshake.headers['x-authrite-identity-key']
    const identityKey: string = Array.isArray(identityKeyRaw) ? identityKeyRaw[0] : (identityKeyRaw !== null && identityKeyRaw !== undefined ? identityKeyRaw : '')

    if (identityKey !== '' && roomId.startsWith(identityKey)) {
      try {
        await socket.join(roomId) // Properly handle the promise
        console.log(`User joined room ${roomId}`)
      } catch (error) {
        console.error(`Failed to join room: ${roomId}`, error)
      }
    }
  })

  // Leaving a room
  socket.on('leaveRoom', async (roomId: string) => {
    try {
      await socket.leave(roomId) // Ensures the promise is properly handled
      console.log(`User left room ${roomId}`)
    } catch (error) {
      console.error(`Failed to leave room: ${roomId}`, error)
    }
  })

  // Sending a message to a room
  // Sending a message to a room
  socket.on('sendMessage', ({ roomId, message }: { roomId: string, message: any }) => {
    const identityKeyRaw = socket.handshake.headers['x-authrite-identity-key']
    const identityKey: string = Array.isArray(identityKeyRaw) ? identityKeyRaw[0] : (identityKeyRaw !== null && identityKeyRaw !== undefined ? identityKeyRaw : '')

    if (identityKey !== '') {
      const dataToSend: { sender: string, message?: string | object } = { sender: identityKey }

      if (typeof message === 'object' && Object.keys(message).length !== 0) {
        Object.assign(dataToSend, message)
      } else {
        dataToSend.message = String(message) // Ensuring message is a string
      }

      io.to(roomId).emit(`sendMessage-${roomId}`, dataToSend)
    }
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
    return res // Ensure Response is returned
  }

  next()
})

// Serve Static Files
app.use(express.static('public'))

// Pre-Authrite Routes
preAuthrite.forEach((route: { type: string, path: string, func: (req: Request, res: Response, next: NextFunction) => void }) => {
  app[route.type as 'get' | 'post' | 'put' | 'delete'](`${String(ROUTING_PREFIX)}${String(route.path)}`, route.func)
})

// Authrite Middleware
app.use(authrite.middleware({
  serverPrivateKey: SERVER_PRIVATE_KEY,
  baseUrl: HOSTING_DOMAIN
}))

// Post-Authrite Routes
postAuthrite.forEach((route: { type: string, path: string, func: (req: Request, res: Response, next: NextFunction) => void }) => {
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

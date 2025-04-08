import * as dotenv from 'dotenv'
import express, {
  Express,
  Request as ExpressRequest,
  Response,
  NextFunction,
  RequestHandler
} from 'express'
import bodyParser from 'body-parser'
import { preAuth, postAuth } from './routes/index.js'
import { Logger } from './utils/logger.js'
import sendMessageRoute from './routes/sendMessage.js'
import { Setup } from '@bsv/wallet-toolbox'
import knexLib, { Knex } from 'knex'
import knexConfig from '../knexfile.js'
import type { WalletInterface } from '@bsv/sdk'
import overlayRoutes from './routes/overlayRoutes.js'

dotenv.config()

export const app: Express = express()

const {
  NODE_ENV = 'development',
  ROUTING_PREFIX = '',
  SERVER_PRIVATE_KEY,
  WALLET_STORAGE_URL
} = process.env

if (NODE_ENV === 'development' || process.env.LOGGING_ENABLED === 'true') {
  Logger.enable()
}

export const knex: Knex = (knexLib as any).default?.(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
) ?? (knexLib as any)(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
)

let _wallet: WalletInterface | undefined
let _resolveReady: () => void
export const walletReady = new Promise<void>((resolve) => {
  _resolveReady = resolve
})

export async function initializeWallet (): Promise<void> {
  if (SERVER_PRIVATE_KEY == null || SERVER_PRIVATE_KEY.trim() === '') {
    throw new Error('SERVER_PRIVATE_KEY is not defined in environment variables.')
  }

  _wallet = await Setup.createWalletClientNoEnv({
    chain: 'main',
    rootKeyHex: SERVER_PRIVATE_KEY,
    storageUrl: WALLET_STORAGE_URL
  })

  _resolveReady()
}

export async function getWallet (): Promise<WalletInterface> {
  await walletReady
  if (_wallet == null) {
    throw new Error('Wallet has not been initialized yet.')
  }
  return _wallet
}

export const appReady = (async () => {
  await initializeWallet()
  useRoutes()
})()

export function useRoutes (): void {
  app.use(bodyParser.json({ limit: '1gb', type: 'application/json' }))

  // CORS setup
  app.use((req, res, next) => {
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

  // Inject test-safe identityKey from Authorization header
  app.use((req, res, next) => {
    const identityKey = req.get('Authorization')
    if (identityKey != null && identityKey.trim() !== '') {
      // @ts-expect-error - inject auth for overlay routes
      req.auth = { identityKey }
    }
    next()
  })

  // Register overlay routes
  app.use('/overlay', overlayRoutes)

  // Pre-auth routes
  preAuth.forEach((route) => {
    app[route.type as 'get' | 'post' | 'put' | 'delete'](
      `${String(ROUTING_PREFIX)}${String(route.path)}`,
      route.func as unknown as (req: ExpressRequest, res: Response, next: NextFunction) => void
    )
  })

  // Post-auth routes
  postAuth.forEach((route) => {
    if (route.path === '/sendMessage') {
      app[route.type as 'get' | 'post' | 'put' | 'delete'](
        `${ROUTING_PREFIX}${route.path}`,
        sendMessageRoute.func as unknown as RequestHandler
      )
    } else {
      app[route.type as 'get' | 'post' | 'put' | 'delete'](
        `${ROUTING_PREFIX}${route.path}`,
        route.func as RequestHandler
      )
    }
  })
}

/**
 * @file app.ts
 * @description Main application bootstrapper for MessageBoxServer.
 * Sets up Express middleware, routes, and initializes the wallet client.
 */

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
import knexConfig from './knexfile.js'
import type { WalletInterface } from '@bsv/sdk'
import { createAuthMiddleware } from '@bsv/auth-express-middleware'

dotenv.config()

// Create the Express app instance
export const app: Express = express()

// Load environment variables
const {
  NODE_ENV = 'development',
  ROUTING_PREFIX = '',
  SERVER_PRIVATE_KEY,
  WALLET_STORAGE_URL
} = process.env

// Enable logger in dev mode or if explicitly enabled
if (NODE_ENV === 'development' || process.env.LOGGING_ENABLED === 'true') {
  Logger.enable()
}

// Initialize Knex instance based on environment
export const knex: Knex = (knexLib as any).default?.(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
) ?? (knexLib as any)(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
)

// Wallet initialization logic
let _wallet: WalletInterface | undefined
let _resolveReady: () => void
export const walletReady = new Promise<void>((resolve) => {
  _resolveReady = resolve
})

/**
 * @function initializeWallet
 * @description Creates the WalletClient from env variables for later use in message handling.
 */
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

/**
 * @function getWallet
 * @returns {Promise<WalletInterface>}
 * @throws If the wallet has not been initialized yet.
 */
export async function getWallet (): Promise<WalletInterface> {
  await walletReady
  if (_wallet == null) {
    throw new Error('Wallet has not been initialized yet.')
  }
  return _wallet
}

// Run on app startup to prep wallet and activate routes
export const appReady = (async () => {
  await initializeWallet()
  await useRoutes()
})()

/**
 * @function useRoutes
 * @description Mounts middleware and routes, including pre-auth and post-auth routes.
 */
export async function useRoutes (): Promise<void> {
  // Parse incoming JSON bodies with a high limit
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

  await walletReady
  if (_wallet == null) {
    throw new Error('Wallet is not initialized for auth middleware')
  }

  app.use(
    createAuthMiddleware({
      wallet: _wallet
    })
  )

  // Register pre-authentication routes (no auth required)
  preAuth.forEach((route) => {
    app[route.type as 'get' | 'post' | 'put' | 'delete'](
      `${String(ROUTING_PREFIX)}${String(route.path)}`,
      route.func as unknown as (req: ExpressRequest, res: Response, next: NextFunction) => void
    )
  })

  // Register post-authentication routes (requires auth header)
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

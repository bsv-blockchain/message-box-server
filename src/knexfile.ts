// src/knexfile.ts
import { fileURLToPath } from 'url'
import path from 'path'
import dotenv from 'dotenv'
import type { Knex } from 'knex'

dotenv.config()

const fileName = fileURLToPath(import.meta.url)
const dirName = path.dirname(fileName)

const connectionConfig = process.env.KNEX_DB_CONNECTION != null && process.env.KNEX_DB_CONNECTION.trim() !== ''
  ? JSON.parse(process.env.KNEX_DB_CONNECTION)
  : undefined

const config: Knex.Config = {
  client: 'mysql2',
  connection: connectionConfig,
  useNullAsDefault: true,
  migrations: {
    directory: path.resolve(dirName, './migrations')
  },
  pool: {
    min: 0,
    max: 7,
    idleTimeoutMillis: 15000
  }
}

const knexfile: { [key: string]: Knex.Config } = {
  development: config,
  staging: config,
  production: config
}

export default knexfile

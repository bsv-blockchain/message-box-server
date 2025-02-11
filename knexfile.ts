import { Knex } from 'knex'
import dotenv from 'dotenv'

dotenv.config()

const config: Knex.Config = {
  client: 'mysql',
  connection: process.env.KNEX_DB_CONNECTION !== undefined && process.env.KNEX_DB_CONNECTION !== ''
    ? JSON.parse(process.env.KNEX_DB_CONNECTION)
    : undefined,
  useNullAsDefault: true,
  migrations: {
    directory: './src/migrations',
    extension: 'ts'
  },
  pool: {
    min: 0,
    max: 7,
    idleTimeoutMillis: 15000
  }
}

const knexConfig: { [key: string]: Knex.Config } = {
  development: config,
  staging: config,
  production: config
}

export default knexConfig

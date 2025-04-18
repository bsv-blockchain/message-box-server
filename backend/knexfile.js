import dotenv from 'dotenv'
dotenv.config()
const connectionConfig = process.env.KNEX_DB_CONNECTION != null && process.env.KNEX_DB_CONNECTION.trim() !== ''
  ? JSON.parse(process.env.KNEX_DB_CONNECTION)
  : undefined
const config = {
  client: 'mysql2',
  connection: connectionConfig,
  useNullAsDefault: true,
  migrations: {
    directory: './out/src/migrations'
  },
  pool: {
    min: 0,
    max: 7,
    idleTimeoutMillis: 15000
  }
}
const knexfile = {
  development: config,
  staging: config,
  production: config
}
export default knexfile
// # sourceMappingURL=knexfile.js.map

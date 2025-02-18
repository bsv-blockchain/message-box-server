const dotenv = require('dotenv')

dotenv.config()

const config = {
  client: 'mysql',
  connection: (() => {
    try {
      return process.env.KNEX_DB_CONNECTION ? JSON.parse(process.env.KNEX_DB_CONNECTION) : undefined
    } catch (error) {
      console.error('Invalid KNEX_DB_CONNECTION:', process.env.KNEX_DB_CONNECTION)
      return undefined
    }
  })(),
  useNullAsDefault: true,
  migrations: {
    directory: './src/migrations',
    extension: 'js' // Change to 'ts' only if TypeScript is properly compiled
  },
  pool: {
    min: 0,
    max: 7,
    idleTimeoutMillis: 15000
  }
}

const knexConfig = {
  development: config,
  staging: config,
  production: config
}

module.exports = knexConfig

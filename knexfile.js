import dotenv from 'dotenv'

dotenv.config()

const baseConfig = {
  client: 'mysql2',
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
    extension: 'ts',
    loadExtensions: ['.ts', '.js']
  },
  pool: {
    min: 0,
    max: 7,
    idleTimeoutMillis: 15000
  }
}

const knexConfig = {
  development: baseConfig,
  staging: baseConfig,
  production: baseConfig,
  test: {
    client: 'sqlite3',
    connection: { filename: './test.sqlite3' }, // SQLite for testing
    useNullAsDefault: true,
    migrations: {
      directory: './src/migrations',
      extension: 'ts',
      loadExtensions: ['.ts', '.js']
    },
    pool: {
      min: 0,
      max: 1, // Small pool since SQLite doesn't support concurrent writes well
      idleTimeoutMillis: 5000
    }
  }
}

export default knexConfig

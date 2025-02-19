import { http } from './src/index' // Import the HTTP server instance
import knexConfig from './knexfile'
import knexLib from 'knex'

const knex = knexLib(knexConfig.test) // Use the test database

beforeAll(async () => {
  await knex.migrate.latest() // Run migrations before tests
  http.listen(4000) // Start test server on port 4000
})

afterAll(async () => {
  await knex.destroy() // Close database connection
  http.close() // Shut down server after tests
})

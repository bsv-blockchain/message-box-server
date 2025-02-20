import { createServer } from 'http'
import { HTTP_PORT, http } from '../../index.js'
import knexConfig from '../../../knexfile.js'
import * as knexLib from 'knex'

let serverInstance: ReturnType<typeof createServer> | null = null
let knex: knexLib.Knex | null = null

/**
 * Starts the test server.
 */
export async function startTestServer (): Promise<void> {
  if (serverInstance !== null) {
    console.log('Test server is already running.')
    return
  }

  console.log('Starting test database and server...')

  // Initialize Knex properly
  knex = ((knexLib as any).default?.(knexConfig.test) ?? (knexLib as any)(knexConfig.test)) as knexLib.Knex

  // Ensure migrations are applied
  await knex.migrate.latest()

  // Start the HTTP server
  serverInstance = http.listen(HTTP_PORT, () => {
    console.log(`Test server running on port ${HTTP_PORT}`)
  })

  // Wait to ensure the server is ready
  await new Promise(resolve => setTimeout(resolve, 3000))
}

/**
 * Stops the test server.
 */
export async function stopTestServer (): Promise<void> {
  if (serverInstance === null) {
    console.log('No test server running.')
    return
  }

  console.log('Stopping test server...')

  if (knex !== null) {
    await knex.destroy() // Close the database connection
    knex = null
  }

  serverInstance.close(() => {
    console.log('Test server stopped.')
    serverInstance = null
  })
}

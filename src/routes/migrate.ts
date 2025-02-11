import { Request, Response } from 'express'
import knexConfig from '../../knexfile'
import knexLib from 'knex'

const { NODE_ENV = 'development', MIGRATE_KEY } = process.env

const knex = knexLib(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
)

interface MigrateRequest extends Request {
  body: { migratekey?: string }
}

export default {
  type: 'post',
  path: '/migrate',
  knex,
  hidden: true,
  func: async (req: MigrateRequest, res: Response): Promise<Response> => {
    if (
      typeof MIGRATE_KEY === 'string' &&
      MIGRATE_KEY.length > 10 &&
      req.body.migratekey === MIGRATE_KEY
    ) {
      try {
        const result = await knex.migrate.latest()
        return res.status(200).json({
          status: 'success',
          result
        })
      } catch (error) {
        console.error('Migration error:', error)
        return res.status(500).json({
          status: 'error',
          code: 'ERR_MIGRATION_FAILED',
          description: 'An error occurred during the migration process.'
        })
      }
    } else {
      return res.status(401).json({
        status: 'error',
        code: 'ERR_UNAUTHORIZED',
        description: 'Access with this key was denied.'
      })
    }
  }
}

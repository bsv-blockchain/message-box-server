const knex =
  (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging')
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)

const MIGRATE_KEY = process.env.MIGRATE_KEY

module.exports = {
  type: 'post',
  path: '/migrate',
  knex,
  hidden: true,
  func: async (req, res) => {
    if (
      typeof MIGRATE_KEY === 'string' &&
      MIGRATE_KEY.length > 10 &&
      req.body.migratekey === MIGRATE_KEY
    ) {
      const result = await knex.migrate.latest()
      res.status(200).json({
        status: 'success',
        result
      })
    } else {
      res.status(401).json({
        status: 'error',
        code: 'ERR_UNAUTHORIZED',
        description: 'Access with this key was denied.'
      })
    }
  }
}

/* eslint-env jest */
const migrate = require('../migrate')

jest.mock('knex', () => () => ({
  migrate: {
    latest: jest.fn()
  }
}))

const res = {
  status: jest.fn()
}

const json = jest.fn()

res.status.mockReturnValue({
  json
})

describe('migrate', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })
  it('Runs migrations when key is valid', async () => {
    await migrate.func({ body: { migratekey: process.env.MIGRATE_KEY } }, res)
    expect(migrate.knex.migrate.latest).toHaveBeenCalled()
    expect(res.status).toHaveBeenLastCalledWith(200)
    expect(json).toHaveBeenLastCalledWith({
      status: 'success'
    })
  })
  it('Returns error when migrate key is invalid', async () => {
    await migrate.func({ body: { migratekey: 'INVALID_MIGRATE_KEY' } }, res)
    expect(migrate.knex.migrate.latest).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenLastCalledWith(401)
    expect(json).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'error',
        code: 'ERR_UNAUTHORIZED'
      })
    )
  })
})

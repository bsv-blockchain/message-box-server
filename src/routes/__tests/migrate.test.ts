/* eslint-env jest */
import migrate from '../migrate'
import { Request, Response } from 'express'

// Mock knex with migrate.latest function
jest.mock('knex', () => () => ({
  migrate: {
    latest: jest.fn()
  }
}))

// Define typed response mock
const json = jest.fn()
const res: Partial<Response> = {
  status: jest.fn().mockReturnValue({ json })
}

describe('migrate', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('Runs migrations when key is valid', async () => {
    const validReq: Pick<Request, 'body'> = {
      body: { migratekey: process.env.MIGRATE_KEY ?? '' }
    }

    await migrate.func(validReq as Request, res as Response)

    expect(migrate.knex.migrate.latest).toHaveBeenCalled()
    expect(res.status).toHaveBeenLastCalledWith(200)
    expect(json).toHaveBeenLastCalledWith({ status: 'success' })
  })

  it('Returns error when migrate key is invalid', async () => {
    const invalidReq: Pick<Request, 'body'> = {
      body: { migratekey: 'INVALID_MIGRATE_KEY' }
    }

    await migrate.func(invalidReq as Request, res as Response)

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

/* eslint-env jest */
import acknowledgeMessage from '../acknowledgeMessage'
import mockKnex from 'mock-knex'
import { AuthriteRequest } from '../../utils/testingInterfaces'
import { Response } from 'express'

// ✅ Ensure proper handling of mock-knex
const knex = acknowledgeMessage.knex
let queryTracker: mockKnex.Tracker

// ✅ Define Mock Express Response Object
const mockRes: Partial<Response> = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis()
}

let validReq: AuthriteRequest

describe('acknowledgeMessage', () => {
  beforeAll(() => {
    // ✅ Ensure mockKnex is correctly initialized
    mockKnex.mock(knex)
  })

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((e) => {
      throw e
    })

    // ✅ Get tracker and install it
    queryTracker = mockKnex.getTracker() as mockKnex.Tracker
    queryTracker.install()

    // ✅ Fully typed mock request
    validReq = {
      authrite: {
        identityKey: 'mockIdKey'
      },
      body: {
        messageIds: ['123']
      },
      get: jest.fn(),
      header: jest.fn()
    } as unknown as AuthriteRequest
  })

  afterEach(() => {
    jest.clearAllMocks()

    if (queryTracker !== null && queryTracker !== undefined) {
      queryTracker.uninstall()
    }
  })

  afterAll(() => {
    mockKnex.unmock(knex)
  })

  it('Throws an error if messageId is missing', async () => {
    delete validReq.body.messageIds
    await acknowledgeMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGE_ID_REQUIRED'
    }))
  })

  it('Throws an error if messageIds is not an Array', async () => {
    validReq.body.messageIds = '24' as unknown as string[] // ❌ Invalid type

    await acknowledgeMessage.func(validReq, mockRes as Response) // ✅ Ensure execution completes

    expect(mockRes.status).toHaveBeenCalledWith(400) // ✅ Check if status is 400
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGE_ID',
      description: 'Message IDs must be formatted as an array of strings!' // ✅ Fixed case mismatch
    }))
  }, 7000)

  it('Deletes a message', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        expect(q.method).toEqual('del')
        expect(q.sql).toEqual(
          'delete from `messages` where `recipient` = ? and `messageId` in (?)'
        )
        expect(q.bindings).toEqual([
          'mockIdKey',
          '123'
        ])
        q.response(true)
      } else {
        q.response([])
      }
    })

    await acknowledgeMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success'
    }))
  })

  it('Throws an error if deletion fails', async () => {
    queryTracker.on('query', (q, s) => {
      // console.log(`Query Step: ${s}, SQL: ${q.sql}, Bindings: ${JSON.stringify(q.bindings)}`)

      if (s === 1) {
        expect(q.method).toEqual('del')
        expect(q.sql).toEqual(
          'delete from `messages` where `recipient` = ? and `messageId` in (?)'
        )

        // ✅ Fix: Ensure `messageIds` is an **array of strings**
        expect(q.bindings).toEqual([
          'mockIdKey',
          '123' // ✅ Expecting a string, since `.whereIn()` correctly formats it
        ])

        q.response(0) // ✅ Ensure no records are deleted (simulating failure)
      }
    })

    // ✅ Ensure function handles failed deletion correctly
    await acknowledgeMessage.func(validReq, mockRes as Response)

    // ✅ Ensure mockRes.status(400) was actually called
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_ACKNOWLEDGMENT',
      description: 'Message not found!'
    }))
  })

  it('Throws unknown errors', async () => {
    queryTracker.on('query', (q, s) => {
      throw new Error('Failed')
    })
    await expect(acknowledgeMessage.func(validReq, mockRes as Response)).rejects.toThrow()
  })
})

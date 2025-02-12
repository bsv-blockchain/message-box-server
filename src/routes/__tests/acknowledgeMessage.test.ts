/* eslint-env jest */
import acknowledgeMessage from '../acknowledgeMessage'
import mockKnex from 'mock-knex'
import { AuthriteRequest } from '../../utils/testingInterfaces'
import { Response } from 'express'

// Ensure proper handling of mock-knex
const knex = acknowledgeMessage.knex
let queryTracker: mockKnex.Tracker

// Define Mock Express Response Object
const mockRes: Partial<Response> = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis()
}

let validReq: AuthriteRequest

describe('acknowledgeMessage', () => {
  beforeAll(() => {
    mockKnex.mock(knex)
  })

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((e) => {
      throw e
    })

    queryTracker = mockKnex.getTracker() as mockKnex.Tracker
    queryTracker.install()

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
    validReq.body.messageIds = '24' as unknown as string[]

    await acknowledgeMessage.func(validReq, mockRes as Response)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGE_ID',
      description: 'Message IDs must be formatted as an array of strings!'
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
      if (s === 1) {
        expect(q.method).toEqual('del')
        expect(q.sql).toEqual(
          'delete from `messages` where `recipient` = ? and `messageId` in (?)'
        )

        expect(q.bindings).toEqual([
          'mockIdKey',
          '123'
        ])

        q.response(0)
      }
    })

    await acknowledgeMessage.func(validReq, mockRes as Response)

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

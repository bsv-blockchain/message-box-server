/* eslint-env jest */
const acknowledgeMessage = require('../acknowledgeMessage')
const mockKnex = require('mock-knex')

const mockRes = {
  status: jest.fn(() => mockRes),
  json: jest.fn(() => mockRes)
}
let queryTracker, validReq

describe('acknowledgeMessage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(e => {
      throw e
    })
    mockKnex.mock(acknowledgeMessage.knex)
    queryTracker = require('mock-knex').getTracker()
    queryTracker.install()

    // Mock Request
    validReq = {
      authrite: {
        identityKey: 'mockIdKey'
      },
      body: {
        messageIds: [123]
      }
    }
  })
  afterEach(() => {
    jest.clearAllMocks()
    queryTracker.uninstall()
    mockKnex.unmock(acknowledgeMessage.knex)
  })
  it('Throws an error if messageId is missing', async () => {
    delete validReq.body.messageIds
    await acknowledgeMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGE_ID_REQUIRED'
    }))
  })
  it('Throws an error if messageIds is not an Array', async () => {
    validReq.body.messageIds = '24'
    await acknowledgeMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGE_ID',
      description: 'Message IDs must be formatted as an Array of Numbers!'
    }))
  })
  it('Throws an error if messageIds is not an Array of Numbers', async () => {
    validReq.body.messageIds = [12, '24']
    await acknowledgeMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGE_ID',
      description: 'Message IDs must be formatted as an Array of Numbers!'
    }))
  })
  it('Deletes a message', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        expect(q.method).toEqual('del')
        expect(q.sql).toEqual(
          'delete from `messages` where `recipient` = ? and `messageId` in (?)'
        )
        expect(q.bindings).toEqual([
          'mockIdKey',
          123
        ])
        q.response(true)
      } else {
        q.response([])
      }
    })

    await acknowledgeMessage.func(validReq, mockRes)
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
          123
        ])
        q.response(false)
      } else {
        q.response([])
      }
    })

    await acknowledgeMessage.func(validReq, mockRes)
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
    await expect(acknowledgeMessage.func(validReq, mockRes)).rejects.toThrow()
  })
})

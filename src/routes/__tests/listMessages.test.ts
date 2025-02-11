/* eslint-env jest */
const listMessages = require('../listMessages')
const mockKnex = require('mock-knex')

const mockRes = {
  status: jest.fn(() => mockRes),
  json: jest.fn(() => mockRes)
}
let queryTracker, validReq, validRes, validMessageBoxes, validMessages

describe('listMessages', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(e => {
      throw e
    })
    mockKnex.mock(listMessages.knex)
    queryTracker = require('mock-knex').getTracker()
    queryTracker.install()

    validMessages = [{
      sender: '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1',
      messageBoxId: 42,
      body: '{}'
    }]

    // Mock Data
    validRes = {
      status: 'success',
      messages: validMessages
    }
    validMessageBoxes = [
      {
        messageBoxId: 42
      },
      {
        messageBoxId: 31
      }
    ]

    // Mock Request]
    validReq = {
      authrite: {
        identityKey: 'mockIdKey'
      },
      body: {
        messageBox: 'payment_inbox'
      }
    }
  })
  afterEach(() => {
    jest.clearAllMocks()
    queryTracker.uninstall()
    mockKnex.unmock(listMessages.knex)
  })
  it('Throws an error if a messageBox is not provided', async () => {
    validReq.body.messageBox = undefined
    queryTracker.on('query', (q, s) => {
      q.response([])
    })
    await listMessages.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGEBOX_REQUIRED',
      description: 'Please provide the name of a valid MessageBox!'
    }))
  })
  it('Throws an error if messageBox is not a string', async () => {
    validReq.body.messageBox = 123
    queryTracker.on('query', (q, s) => {
      q.response([])
    })
    await listMessages.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGEBOX',
      description: 'MessageBox name must a string!'
    }))
  })
  it('Throws an error if no matching messageBox is found', async () => {
    validReq.body.messageBox = 'pay_inbox'
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        expect(q.method).toEqual('select')
        expect(q.sql).toEqual(
          'select `messageBoxId` from `messageBox` where `identityKey` = ? and `type` = ?'
        )
        q.response([undefined])
      } else {
        q.response([])
      }
    })
    await listMessages.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      messages: []
    }))
  })
  it('Returns ID of messageBox', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        expect(q.method).toEqual('select')
        expect(q.sql).toEqual(
          'select `messageBoxId` from `messageBox` where `identityKey` = ? and `type` = ?'
        )
        expect(q.bindings).toEqual([
          'mockIdKey',
          'payment_inbox'
        ])
        q.response([validMessageBoxes[0]])
      } else if (s === 2) {
        q.response(validMessages)
      } else {
        q.response([])
      }
    })
    await listMessages.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      messages: validMessages
    }))
  })
  it('Returns empty array if no messages found', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([{ messageBoxId: 123 }])
      } else if (s === 2) {
        expect(q.method).toEqual('select')
        expect(q.sql).toEqual(
          'select `messageId`, `body`, `sender`, `created_at`, `updated_at` from `messages` where `recipient` = ? and `messageBoxId` = ?'
        )
        q.response([])
      } else {
        q.response([])
      }
    })
    await listMessages.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      messages: []
    }))
  })
  it('Returns list of messages found', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([{ messageBoxId: 123 }])
      } else if (s === 2) {
        expect(q.method).toEqual('select')
        expect(q.sql).toEqual(
          'select `messageId`, `body`, `sender`, `created_at`, `updated_at` from `messages` where `recipient` = ? and `messageBoxId` = ?'
        )
        q.response(validMessages)
      } else {
        q.response([])
      }
    })
    await listMessages.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      messages: validMessages
    }))
  })
  it('Throws unknown errors', async () => {
    queryTracker.on('query', (q, s) => {
      throw new Error('Failed')
    })
    await expect(listMessages.func(validReq, mockRes)).rejects.toThrow()
  })
})

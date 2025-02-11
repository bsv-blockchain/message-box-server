/* eslint-env jest */
const sendMessage = require('../sendMessage')
const mockKnex = require('mock-knex')

const mockRes = {
  status: jest.fn(() => mockRes),
  json: jest.fn(() => mockRes)
}
let queryTracker, validReq, validRes, validMessageBox

describe('sendMessage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(e => {
      throw e
    })
    mockKnex.mock(sendMessage.knex)
    queryTracker = require('mock-knex').getTracker()
    queryTracker.install()

    // Mock Data
    validRes = {
      status: 'success'
    }
    validMessageBox = {
      messageBoxId: 42,
      type: 'payment_inbox'
    }
    validReq = {
      authrite: {
        identityKey: 'mockIdKey'
      },
      body: {
        message: {
          recipient: '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1',
          messageBox: 'payment_inbox',
          body: JSON.stringify({})
        }
      }
    }
  })
  afterEach(() => {
    jest.clearAllMocks()
    queryTracker.uninstall()
    mockKnex.unmock(sendMessage.knex)
  })
  it('Throws an error if message is missing', async () => {
    delete validReq.body.message
    await sendMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGE_REQUIRED'
    }))
  })
  it('Throws an error if message is not an object', async () => {
    validReq.body.message = 'My message to send'
    await sendMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGE',
      description: 'Message properties must be contained in a message object!'
    }))
  })
  it('Throws an error if recipient is missing', async () => {
    delete validReq.body.message.recipient
    await sendMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_RECIPIENT_REQUIRED'
    }))
  })
  it('Throws an error if recipient is not a string', async () => {
    validReq.body.message.recipient = Buffer.from('bob')
    await sendMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_RECIPIENT',
      description: 'Recipient must be a compressed public key formatted as a hex string!'
    }))
  })
  it('Returns error if messageBox is missing', async () => {
    delete validReq.body.message.messageBox
    await sendMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGEBOX_REQUIRED'
    }))
  })
  it('Throws an error if messageBox is not a string', async () => {
    validReq.body.message.messageBox = Buffer.from('payment_inbox')
    await sendMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGEBOX',
      description: 'MessageBox must be a string!'
    }))
  })
  it('Returns error if message body is missing', async () => {
    delete validReq.body.message.body
    await sendMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGE_BODY_REQUIRED'
    }))
  })
  it('Throws an error if the message body is not a string', async () => {
    validReq.body.message.body = Buffer.from('this is my message body')
    await sendMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGE_BODY',
      description: 'Message body must be formatted as a string!'
    }))
  })
  it('Queries for messageBox that does not yet exist', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        expect(q.method).toEqual('update')
        expect(q.sql).toEqual(
          'update `messageBox` set `updated_at` = ? where `identityKey` = ? and `type` = ?'
        )
        expect(q.bindings).toEqual([
          expect.any(Date),
          '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1',
          'payment_inbox'
        ])
        q.response(false)
      } else if (s === 3) {
        q.response([validMessageBox])
      } else {
        q.response([])
      }
    })
    await sendMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining(validRes))
  })
  it('Selects an existing messageBox', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response(true)
      } else if (s === 2) {
        expect(q.method).toEqual('select')
        expect(q.sql).toEqual(
          'select `messageBoxId` from `messageBox` where `identityKey` = ? and `type` = ?'
        )
        expect(q.bindings).toEqual([
          '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1',
          'payment_inbox'
        ])
        q.response([validMessageBox])
      } else {
        q.response([])
      }
    })
    await sendMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining(validRes))
  })
  it('Inserts a new message into a messageBox', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response(true)
      } else if (s === 2) {
        q.response([validMessageBox])
      } else if (s === 3) {
        expect(q.method).toEqual('insert')
        expect(q.sql).toEqual(
          'insert into `messages` (`body`, `created_at`, `messageBoxId`, `recipient`, `sender`, `updated_at`) values (?, ?, ?, ?, ?, ?)'
        )
        expect(q.bindings).toEqual([
          '{}',
          expect.any(Date),
          42,
          validReq.body.message.recipient,
          validReq.authrite.identityKey,
          expect.any(Date)
        ])
        q.response(true)
      } else {
        q.response([])
      }
    })
    await sendMessage.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining(validRes))
  })
  it('Throws unknown errors', async () => {
    queryTracker.on('query', (q, s) => {
      throw new Error('Failed')
    })
    await expect(sendMessage.func(validReq, mockRes)).rejects.toThrow()
  })
})

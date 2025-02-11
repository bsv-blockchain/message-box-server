/* eslint-env jest */
import sendMessage from '../sendMessage'
import mockKnex, { getTracker, Tracker } from 'mock-knex'
import { Request, Response } from 'express'

interface Message {
  messageId: string
  recipient: string
  messageBox: string
  body: string
}

interface SendMessageRequest extends Request {
  authrite: { identityKey: string }
  body: { message?: Message }
}

const mockRes: Partial<Response> = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis()
}

let queryTracker: Tracker
let validReq: SendMessageRequest
let validRes: { status: string }
let validMessageBox: { messageBoxId: number, type: string }

describe('sendMessage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((e) => {
      throw e
    })

    mockKnex.mock(sendMessage.knex)
    queryTracker = getTracker()
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
          messageId: 'mock-message-id',
          recipient: '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1',
          messageBox: 'payment_inbox',
          body: JSON.stringify({})
        }
      },
      get: jest.fn(),
      header: jest.fn()
    } as unknown as SendMessageRequest
  })

  afterEach(() => {
    jest.clearAllMocks()
    queryTracker.uninstall()
    mockKnex.unmock(sendMessage.knex)
  })

  it('Throws an error if message is missing', async () => {
    delete validReq.body.message
    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGE_REQUIRED'
    }))
  })

  it('Throws an error if message is not an object', async () => {
    validReq.body.message = 'My message to send' as unknown as Message
    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGE',
      description: 'Message properties must be contained in a message object!'
    }))
  })

  it('Throws an error if recipient is missing', async () => {
    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      validReq.body.message.recipient = undefined as unknown as string
    }
    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_RECIPIENT_REQUIRED'
    }))
  })

  it('Throws an error if recipient is not a string', async () => {
    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      validReq.body.message.recipient = Buffer.from('bob').toString() as unknown as string
    }
    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_RECIPIENT',
      description: 'Recipient must be a compressed public key formatted as a hex string!'
    }))
  })

  it('Returns error if messageBox is missing', async () => {
    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      validReq.body.message.messageBox = undefined as unknown as string
    }
    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGEBOX_REQUIRED'
    }))
  })

  it('Throws an error if messageBox is not a string', async () => {
    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      validReq.body.message.messageBox = Buffer.from('payment_inbox').toString()
    }
    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGEBOX',
      description: 'MessageBox must be a string!'
    }))
  })

  it('Returns error if message body is missing', async () => {
    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      validReq.body.message.body = undefined as unknown as string
    }
    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGE_BODY_REQUIRED'
    }))
  })

  it('Throws an error if the message body is not a string', async () => {
    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      validReq.body.message.body = Buffer.from('this is my message body').toString()
    }
    await sendMessage.func(validReq, mockRes as Response)
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
        q.response(false)
      } else if (s === 3) {
        q.response([validMessageBox])
      } else {
        q.response([])
      }
    })
    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining(validRes))
  })

  it('Selects an existing messageBox', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response(true)
      } else if (s === 2) {
        q.response([validMessageBox])
      } else {
        q.response([])
      }
    })
    await sendMessage.func(validReq, mockRes as Response)
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
        q.response(true)
      } else {
        q.response([])
      }
    })
    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining(validRes))
  })

  it('Throws unknown errors', async () => {
    queryTracker.on('query', () => {
      throw new Error('Failed')
    })
    await expect(sendMessage.func(validReq, mockRes as Response)).rejects.toThrow()
  })
})

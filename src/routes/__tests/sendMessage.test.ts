/* eslint-env jest */
import sendMessage from '../sendMessage'
import mockKnex from 'mock-knex'
import { Response } from 'express'
import { Message, SendMessageRequest } from '../../utils/testingInterfaces'

// Ensure proper handling of mock-knex
const knex = sendMessage.knex
let queryTracker: mockKnex.Tracker

// Define Mock Express Response Object
const mockRes: Partial<Response> = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis()
}

let validReq: SendMessageRequest
let validRes: { status: string }
let validMessageBox: { messageBoxId: number, type: string }

describe('sendMessage', () => {
  beforeAll(() => {
    mockKnex.mock(knex)
  })

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((e) => {
      throw e
    })

    queryTracker = mockKnex.getTracker() as mockKnex.Tracker
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

    if (queryTracker !== null && queryTracker !== undefined) {
      queryTracker.uninstall()
    }
  })

  afterAll(() => {
    mockKnex.unmock(knex)
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
      code: 'ERR_INVALID_RECIPIENT',
      description: 'Recipient must be a compressed public key formatted as a hex string!'
    }))
  })

  it('Throws an error if recipient is not a string', async () => {
    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      validReq.body.message.recipient = 123 as unknown as string
    }
    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_RECIPIENT',
      description: 'Recipient must be a compressed public key formatted as a hex string!'
    }))
  }, 10000)

  it('Returns error if messageBox is missing', async () => {
    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      validReq.body.message.messageBox = undefined as unknown as string
    }
    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGEBOX'
    }))
  })

  it('Throws an error if messageBox is not a string', async () => {
    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      validReq.body.message.messageBox = 123 as unknown as string
    }

    if (validReq.body.message !== null && validReq.body.message !== undefined) {
      console.log('Modified messageBox:', validReq.body.message.messageBox)
    }
    const response = await sendMessage.func(validReq, mockRes as Response)

    console.log('After calling sendMessage.func, Response:', response)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGEBOX',
      description: 'MessageBox must be a string!'
    }))
  }, 10000)

  it('Throws an error if the message body is not a string', async () => {
    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      validReq.body.message.body = { text: 'this is my message body' } as unknown as string
    }

    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      console.log('Modified body:', validReq.body.message.body)
    }

    const response = await sendMessage.func(validReq, mockRes as Response)
    console.log('After calling sendMessage.func, Response:', response)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGE_BODY',
      description: 'Message body must be formatted as a string!'
    }))
  }, 10000)

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

  it('Queries for messageBox that does not yet exist', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response(false) // Simulating that the messageBox doesn't exist
      } else if (s === 2) {
        q.response([validMessageBox]) // Simulating successful messageBox creation
      } else {
        q.response([]) // Default response
      }
    })

    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      validReq.body.message.body = 'Hello, world!'
    }

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

/* eslint-env jest */
import sendMessage, { calculateMessagePrice } from '../sendMessage'
import * as mockKnex from 'mock-knex'
import { Response } from 'express'
import { Message, SendMessageRequest } from '../../utils/testingInterfaces'

// Ensure proper handling of mock-knex
const knex = sendMessage.knex
let queryTracker: mockKnex.Tracker

// Define Mock Express Response Object
const mockRes: jest.Mocked<Response> = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  sendStatus: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
  end: jest.fn().mockReturnThis(),
  setHeader: jest.fn().mockReturnThis(),
  getHeader: jest.fn(),
  getHeaders: jest.fn(),
  header: jest.fn().mockReturnThis(),
  type: jest.fn().mockReturnThis(),
  format: jest.fn(),
  location: jest.fn().mockReturnThis(),
  redirect: jest.fn().mockReturnThis(),
  append: jest.fn().mockReturnThis(),
  render: jest.fn(),
  vary: jest.fn().mockReturnThis(),
  cookie: jest.fn().mockReturnThis(),
  clearCookie: jest.fn().mockReturnThis()
} as unknown as jest.Mocked<Response>

let validReq: SendMessageRequest
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let validRes: { status: string }
let validMessageBox: { messageBoxId: number, type: string }

describe('sendMessage', () => {
  beforeAll(() => {
    (mockKnex as any).mock(knex)
  })

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((e) => {
      throw e
    })

    queryTracker = (mockKnex as any).getTracker() as mockKnex.Tracker
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
    (mockKnex as any).unmock(knex)
  })

  it('Throws an error if message is missing', async () => {
    delete validReq.body.message

    // Simulate middleware behavior
    validReq.payment = { satoshisPaid: 0 }

    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGE_REQUIRED'
    }))
  })

  it('Throws an error if message is not an object', async () => {
    validReq.body.message = 'My message to send' as unknown as Message

    // Simulate middleware behavior
    validReq.payment = { satoshisPaid: 0 }

    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGE',
      description: 'Message properties must be contained in a message object!'
    }))
  })

  it('Throws an error if recipient is missing', async () => {
    if (validReq.body.message !== null && validReq.body.message !== undefined) {
      validReq.body.message.recipient = undefined as unknown as string
    }

    // Simulate middleware behavior
    validReq.payment = { satoshisPaid: calculateMessagePrice(validReq.body.message?.body ?? '') }

    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_RECIPIENT',
      description: 'Recipient must be a compressed public key formatted as a hex string!'
    }))
  })

  it('Throws an error if recipient is not a string', async () => {
    if (validReq.body.message !== null && validReq.body.message !== undefined) {
      validReq.body.message.recipient = 123 as unknown as string
    }

    // Simulate middleware behavior
    validReq.payment = { satoshisPaid: calculateMessagePrice(validReq.body.message?.body ?? '') }

    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_RECIPIENT',
      description: 'Recipient must be a compressed public key formatted as a hex string!'
    }))
  })

  it('Returns error if messageBox is missing', async () => {
    if (validReq.body.message !== null && validReq.body.message !== undefined) {
      validReq.body.message.messageBox = undefined as unknown as string
    }

    // Simulate middleware behavior
    validReq.payment = { satoshisPaid: calculateMessagePrice(validReq.body.message?.body ?? '') }

    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGEBOX'
    }))
  })

  it('Throws an error if messageBox is not a string', async () => {
    if (validReq.body.message !== null && validReq.body.message !== undefined) {
      validReq.body.message.messageBox = 123 as unknown as string
    }

    // Simulate middleware behavior
    validReq.payment = { satoshisPaid: calculateMessagePrice(validReq.body.message?.body ?? '') }

    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGEBOX',
      description: 'MessageBox must be a string!'
    }))
  })

  it('Throws an error if the message body is not a string', async () => {
    if (validReq.body.message !== null && validReq.body.message !== undefined) {
      validReq.body.message.body = { text: 'this is my message body' } as unknown as string
    }

    // Simulate middleware behavior - Ensure valid string input
    const messageBody = typeof validReq.body.message?.body === 'string' ? validReq.body.message.body : ''
    validReq.payment = { satoshisPaid: calculateMessagePrice(messageBody) }

    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGE_BODY',
      description: 'Message body must be formatted as a string!'
    }))
  })

  it('Returns error if message body is missing', async () => {
    if (validReq.body.message !== null && validReq.body.message !== undefined) {
      validReq.body.message.body = undefined as unknown as string
    }

    // Simulate middleware behavior
    validReq.payment = { satoshisPaid: calculateMessagePrice(validReq.body.message?.body ?? '') }

    await sendMessage.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGE_BODY_REQUIRED'
    }))
  })

  it('Returns base price for an empty message', () => {
    const price = calculateMessagePrice('')
    expect(price).toBe(500) // Base price only
  })

  it('Calculates price for a small message (below 1KB)', () => {
    const price = calculateMessagePrice('Hello, world!')
    expect(price).toBe(500 + 50) // Base price only
  })

  it('Calculates price for a 2KB message', () => {
    const message = 'a'.repeat(2048) // 2KB
    const price = calculateMessagePrice(message)
    expect(price).toBe(500 + 100) // Base price + 2KB * 50 sat
  })

  it('Adds priority fee when enabled', () => {
    const price = calculateMessagePrice('Hello', true)
    expect(price).toBe(500 + 200 + 50) // Base price + priority fee
  })

  it('Handles large messages (5KB)', () => {
    const message = 'a'.repeat(5120) // 5KB
    const price = calculateMessagePrice(message)
    expect(price).toBe(500 + (5 * 50)) // Base price + 5KB * 50
  })

  it('Handles edge case of exactly 1KB message', () => {
    const message = 'a'.repeat(1024) // Exactly 1KB
    const price = calculateMessagePrice(message)
    expect(price).toBe(500 + 50) // Base price + 1KB * 50
  })

  it('Handles edge case of 1KB + 1 byte message', () => {
    const message = 'a'.repeat(1025) // 1KB + 1 byte
    const price = calculateMessagePrice(message)
    expect(price).toBe(500 + 100) // Rounded up to 2KB * 50
  })

  it('Handles messages larger than 10KB', () => {
    const message = 'a'.repeat(10240) // 10KB
    const price = calculateMessagePrice(message)
    expect(price).toBe(500 + (10 * 50)) // Base price + 10KB * 50
  })

  it('Returns error if payment is missing or not processed correctly', async () => {
    delete validReq.payment // Ensure it's fully removed

    await sendMessage.func(validReq, mockRes as Response)

    // Ensure the correct error response is returned
    expect(mockRes.status).toHaveBeenCalledWith(402)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_PAYMENT_REQUIRED'
    }))
  })

  it('Returns error if messageId is missing', async () => {
    if (validReq.body.message !== undefined && validReq.body.message !== null) {
      validReq.body.message.messageId = undefined as unknown as string
    }

    validReq.payment = { satoshisPaid: calculateMessagePrice(validReq.body.message?.body ?? '') } // Simulate middleware behavior

    await sendMessage.func(validReq, mockRes as Response)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGEID',
      description: 'Please provide a unique counterparty-specific messageID!'
    }))
  })

  it('Creates a messageBox when it does not exist', async () => {
    queryTracker.on('query', (q, step: number) => {
      if (step === 1) {
        q.response(0) // Simulate that the messageBox does not exist
      } else if (step === 2) {
        q.response([validMessageBox]) // Simulate messageBox being inserted
      } else if (step === 3) {
        q.response([validMessageBox]) // Ensure this step returns the correct messageBox
      } else {
        q.response([]) // Default response
      }
    })

    validReq.payment = { satoshisPaid: calculateMessagePrice(validReq.body.message?.body ?? '') } // Simulate middleware behavior

    await sendMessage.func(validReq, mockRes as Response)

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success'
    }))
  })

  it('Returns error if the messageBox is not found', async () => {
    queryTracker.on('query', (q, step) => {
      if (step === 1) {
        q.response(1) // Simulate that the messageBox exists
      } else if (step === 2) {
        q.response([]) // Simulate that no messageBoxRecord was found
      }
    })

    validReq.payment = { satoshisPaid: calculateMessagePrice(validReq.body.message?.body ?? '') } // Simulate middleware behavior

    await sendMessage.func(validReq, mockRes as Response)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGEBOX_NOT_FOUND'
    }))
  })

  it('Returns error if message is duplicate', async () => {
    queryTracker.on('query', (q, step: number) => {
      if (step === 1) {
        q.response(1) // Simulate successful messageBox update (returning affected row count)
      } else if (step === 2) {
        q.response([{ messageBoxId: 123 }]) // Simulate finding a valid messageBoxId
      } else if (step === 3) {
        q.reject({ code: 'ER_DUP_ENTRY' }) // Simulate duplicate message error
      } else {
        q.response([]) // Default response for unexpected queries
      }
    })

    validReq.payment = { satoshisPaid: calculateMessagePrice(validReq.body.message?.body ?? '') } // Simulate middleware behavior

    await sendMessage.func(validReq, mockRes as Response)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_DUPLICATE_MESSAGE',
      description: 'Your message has already been sent to the intended recipient!'
    }))
  })

  it('Returns internal error if unexpected error occurs', async () => {
    queryTracker.on('query', () => {
      throw new Error('Unexpected failure') // Simulating an unexpected database failure
    })

    validReq.payment = { satoshisPaid: calculateMessagePrice(validReq.body.message?.body ?? '') } // Simulate middleware behavior

    console.log('[TEST] Sending request that should trigger an internal error...')

    await sendMessage.func(validReq, mockRes as Response)

    console.log('[TEST] Checking if response was handled correctly...')

    // Ensure the response status is set
    expect(mockRes.status).toHaveBeenCalledTimes(1)
    expect(mockRes.status).toHaveBeenCalledWith(500)

    // Ensure the correct JSON error response is returned
    expect(mockRes.json).toHaveBeenCalledTimes(1)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INTERNAL'
    }))
  })

  it('Calls Bugsnag.notify on internal error', async () => {
    // Mock Bugsnag
    globalThis.Bugsnag = { notify: jest.fn() } as any

    queryTracker.on('query', () => {
      throw new Error('Unexpected failure')
    })

    validReq.payment = { satoshisPaid: calculateMessagePrice(validReq.body.message?.body ?? '') }

    await sendMessage.func(validReq, mockRes as Response)

    // Ensure Bugsnag.notify was called
    expect(globalThis.Bugsnag.notify).toHaveBeenCalledWith(expect.any(Error))

    // Ensure a 500 response is sent
    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INTERNAL'
    }))

    // Clean up mock
    delete globalThis.Bugsnag
  })
})

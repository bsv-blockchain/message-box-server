/* eslint-env jest */
import sendMessage, { calculateMessagePrice } from '../sendMessage'
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
  // *******************************************************************************************************/
})

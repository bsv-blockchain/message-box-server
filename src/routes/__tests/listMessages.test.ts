/* eslint-env jest */
import listMessages from '../listMessages'
import mockKnex from 'mock-knex'
import { Response } from 'express'
import { AuthriteRequestMB } from '../../utils/testingInterfaces'

// Ensure proper handling of mock-knex
const knex = listMessages.knex
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

let validReq: AuthriteRequestMB
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let validRes: { status: string, messages: any[] }
let validMessageBoxes: Array<{ messageBoxId: number }>
let validMessages: Array<{ sender: string, messageBoxId: number, body: string }>

describe('listMessages', () => {
  beforeAll(() => {
    mockKnex.mock(knex)
  })

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((e) => {
      throw e
    })

    queryTracker = mockKnex.getTracker() as mockKnex.Tracker
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
      { messageBoxId: 42 },
      { messageBoxId: 31 }
    ]

    // Fully typed mock request
    validReq = {
      authrite: {
        identityKey: 'mockIdKey'
      },
      body: {
        messageBox: 'payment_inbox'
      },
      get: jest.fn(),
      header: jest.fn()
    } as unknown as AuthriteRequestMB
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

  it('Throws an error if a messageBox is not provided', async () => {
    validReq.body.messageBox = undefined
    queryTracker.on('query', (q) => {
      q.response([])
    })
    await listMessages.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_MESSAGEBOX_REQUIRED',
      description: 'Please provide the name of a valid MessageBox!'
    }))
  })

  it('Throws an error if messageBox is not a string', async () => {
    validReq.body.messageBox = 123 as unknown as string
    queryTracker.on('query', (q) => {
      q.response([])
    })
    await listMessages.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_MESSAGEBOX',
      description: 'MessageBox name must be a string!'
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
    await listMessages.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(200)
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
    await listMessages.func(validReq, mockRes as Response)
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
    await listMessages.func(validReq, mockRes as Response)
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
    await listMessages.func(validReq, mockRes as Response)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      messages: validMessages
    }))
  })

  it('Throws unknown errors', async () => {
    queryTracker.on('query', () => {
      throw new Error('Failed')
    })
    await expect(listMessages.func(validReq, mockRes as Response)).rejects.toThrow()
  })
})

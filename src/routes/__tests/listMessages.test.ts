/* eslint-env jest */
import listMessages from '../listMessages'
import mockKnex, { getTracker, Tracker } from 'mock-knex'
import { Response } from 'express'
import { AuthriteRequestMB } from '../../utils/testingInterfaces'

// Mock Express Response Object
const mockRes: Partial<Response> = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis()
}

let queryTracker: Tracker
let validReq: AuthriteRequestMB
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let validRes: { status: string, messages: any[] }
let validMessageBoxes: Array<{ messageBoxId: number }>
let validMessages: Array<{ sender: string, messageBoxId: number, body: string }>

describe('listMessages', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((e) => {
      throw e
    })

    // Set up mock DB tracking
    mockKnex.mock(listMessages.knex)
    queryTracker = getTracker()
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
    queryTracker.uninstall()
    mockKnex.unmock(listMessages.knex)
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

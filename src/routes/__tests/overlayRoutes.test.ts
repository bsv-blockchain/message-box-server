/* eslint-disable @typescript-eslint/no-misused-promises */
import request from 'supertest'
import express from 'express'
import * as advertiserUtils from '../../utils/advertiserIntegration.js'

// Mock everything from app.js
jest.mock('../../app.js', () => {
  const mockDbInstance = {
    insert: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([
      {
        identity_key: 'testKey',
        host: 'https://example.com',
        timestamp: new Date(),
        nonce: 'nonce',
        signature: 'signature',
        txid: 'testTxid',
        created_at: new Date()
      }
    ]),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    select: jest.fn().mockReturnThis(),
    del: jest.fn().mockResolvedValue(1)
  }

  return {
    __esModule: true,
    getWallet: jest.fn(() => ({
      getPublicKey: jest.fn(async () => ({ publicKey: 'mocked-public-key' }))
    })),
    HTTP_PORT: 3000,
    knex: jest.fn(() => mockDbInstance),
    default: jest.fn(() => mockDbInstance)
  }
})

// Mock MessageBoxTopicManager
jest.mock('../../overlay/services/MessageBoxTopicManager.js', () => ({
  MessageBoxTopicManager: {
    broadcast: jest.fn().mockResolvedValue({
      status: 'success',
      txid: 'testTxid',
      advertisement: {
        protocol: 'MB_AD',
        version: '1.0',
        identityKey: 'testKey',
        host: 'https://example.com',
        timestamp: new Date().toISOString(),
        nonce: 'nonce',
        signature: 'signature'
      }
    }),
    rebroadcast: jest.fn().mockResolvedValue({
      status: 'success',
      txid: 'testTxid',
      advertisement: {
        protocol: 'MB_AD',
        version: '1.0',
        identityKey: 'testKey',
        host: 'https://example.com',
        timestamp: new Date().toISOString(),
        nonce: 'nonce',
        signature: 'signature'
      }
    }),
    listRecentAds: jest.fn().mockResolvedValue([
      {
        identityKey: 'testKey',
        host: 'https://example.com',
        timestamp: new Date().toISOString(),
        nonce: 'nonce',
        signature: 'signature',
        txid: 'testTxid'
      }
    ])
  }
}))

// Mock advertiser logic
jest.mock('../../utils/advertiserIntegration.js')

describe('overlayRoutes', () => {
  let app: express.Express
  let overlayRoutes: typeof import('../overlayRoutes.js').default

  const mockAdResult = {
    status: 'success',
    txid: 'testTxid',
    advertisement: {
      protocol: 'MB_AD',
      version: '1.0',
      identityKey: 'testKey',
      host: 'https://example.com',
      timestamp: new Date().toISOString(),
      nonce: 'nonce',
      signature: 'signature'
    }
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    // Load routes *after* mocks
    overlayRoutes = (await import('../overlayRoutes.js')).default

    app = express()
    app.use(express.json())
    app.use('/overlay', overlayRoutes)

    // Ensure broadcast always resolves by default
    jest
      .spyOn(advertiserUtils, 'broadcastAdvertisement')
      .mockResolvedValue(mockAdResult)
  })

  it('POST /overlay/advertise should succeed', async () => {
    const res = await request(app).post('/overlay/advertise')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.advertisement).toBeDefined()
    expect(res.body.txid).toBe('testTxid')
  })

  it('POST /overlay/advertise should fail gracefully', async () => {
    const { MessageBoxTopicManager } = await import('../../overlay/services/MessageBoxTopicManager.js')
    ;(MessageBoxTopicManager.broadcast as jest.Mock).mockRejectedValue(new Error('fail'))

    const res = await request(app).post('/overlay/advertise')
    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Failed to broadcast/)
  })

  it('POST /overlay/rebroadcast should succeed', async () => {
    const res = await request(app).post('/overlay/rebroadcast')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.txid).toBe('testTxid')
  })

  it('POST /overlay/rebroadcast should fail gracefully', async () => {
    const { MessageBoxTopicManager } = await import('../../overlay/services/MessageBoxTopicManager.js')
    ;(MessageBoxTopicManager.rebroadcast as jest.Mock).mockRejectedValue(new Error('fail'))

    const res = await request(app).post('/overlay/rebroadcast')
    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Failed to rebroadcast/)
  })

  it('GET /overlay/ads should handle DB error', async () => {
    const { MessageBoxTopicManager } = await import('../../overlay/services/MessageBoxTopicManager.js')
    ;(MessageBoxTopicManager.listRecentAds as jest.Mock).mockRejectedValue(new Error('db error'))

    const res = await request(app).get('/overlay/ads')
    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Failed to list advertisements/)
  })

  it('GET /overlay/ads should handle DB error', async () => {
    const { knex } = await import('../../app.js')

    const mockQueryBuilder = {
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockRejectedValueOnce(new Error('db error'))
    }

    // Override knex mock implementation
    ;(knex as unknown as jest.Mock).mockImplementation(() => mockQueryBuilder)

    const res = await request(app).get('/overlay/ads')
    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Failed to list advertisements/)
  })
})

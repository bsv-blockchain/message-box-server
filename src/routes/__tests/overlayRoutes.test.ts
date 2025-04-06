/* eslint-disable @typescript-eslint/no-misused-promises */
import request from 'supertest'
import express from 'express'
import * as advertiserUtils from '../../utils/advertiserIntegration.js'

// Mock everything from index.js
jest.mock('../../index.js', () => {
  const mockDbInstance = {
    insert: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([{ fake: 'ad' }]),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    select: jest.fn().mockReturnThis()
  }

  return {
    getWallet: jest.fn(() => ({
      getPublicKey: jest.fn(async () => ({ publicKey: 'mocked-public-key' }))
    })),
    HTTP_PORT: 3000,
    // knex is a function returning our mocked DB instance
    knex: jest.fn(() => mockDbInstance),
    __esModule: true,
    default: jest.fn(() => mockDbInstance)
  }
})

// Mock advertiser logic too
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

    // Defer dynamic import to AFTER mocks
    overlayRoutes = (await import('../overlayRoutes.js')).default

    app = express()
    app.use(express.json())
    app.use('/overlay', overlayRoutes)

    jest.spyOn(advertiserUtils, 'broadcastAdvertisement').mockResolvedValue(mockAdResult)
  })

  it('POST /overlay/advertise should succeed', async () => {
    const res = await request(app).post('/overlay/advertise')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
  })

  it('POST /overlay/advertise should fail gracefully', async () => {
    jest.spyOn(advertiserUtils, 'broadcastAdvertisement').mockRejectedValue(new Error('fail'))
    const res = await request(app).post('/overlay/advertise')
    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Failed to broadcast/)
  })

  it('POST /overlay/rebroadcast should succeed', async () => {
    const res = await request(app).post('/overlay/rebroadcast')
    expect(res.status).toBe(200)
    expect(res.body.txid).toBe('testTxid')
  })

  it('POST /overlay/rebroadcast should fail gracefully', async () => {
    jest.spyOn(advertiserUtils, 'broadcastAdvertisement').mockRejectedValue(new Error('fail'))
    const res = await request(app).post('/overlay/rebroadcast')
    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Failed to rebroadcast/)
  })

  it('GET /overlay/ads should return list', async () => {
    const res = await request(app).get('/overlay/ads')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.ads)).toBe(true)
  })

  it('GET /overlay/ads should handle DB error', async () => {
    const { knex } = await import('../../app.js')

    const mockQueryBuilder = {
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockRejectedValueOnce(new Error('db error'))
    }

    // Cast through unknown to allow overriding the mock implementation
    ;(knex as unknown as jest.Mock).mockImplementation(() => mockQueryBuilder)

    const res = await request(app).get('/overlay/ads')
    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Failed to list advertisements/)
  })
})

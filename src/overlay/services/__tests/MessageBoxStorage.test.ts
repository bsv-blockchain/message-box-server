import { MessageBoxStorage } from '../MessageBoxStorage.js'
import type { Advertisement } from '../../types.js'

const mockInsert = jest.fn().mockReturnThis()
const mockWhere = jest.fn().mockReturnThis()
const mockOrderBy = jest.fn().mockReturnThis()
const mockLimit = jest.fn().mockReturnThis()
const mockFirst = jest.fn()
const mockSelect = jest.fn().mockReturnThis()
const mockDel = jest.fn()
const mockReturning = jest.fn()

// This is the chain returned by knex('table')
const mockQueryBuilder = {
  insert: mockInsert,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  first: mockFirst,
  select: mockSelect,
  del: mockDel,
  returning: mockReturning
}

// The knex function itself (must be callable)
const mockKnex = jest.fn(() => mockQueryBuilder)

const createStorage = (): MessageBoxStorage => new MessageBoxStorage(mockKnex as any)

describe('MessageBoxStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('storeAdvertisement', () => {
    it('stores a valid advertisement with txid', async () => {
      const ad: Advertisement = {
        identityKey: 'pubkey',
        host: 'http://host',
        timestamp: 1234567890,
        nonce: 'abc123',
        signature: 'sig',
        txid: 'txid123'
      }

      const storage = createStorage()
      await storage.storeAdvertisement(ad)

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        identity_key: ad.identityKey,
        host: ad.host,
        timestamp: ad.timestamp,
        nonce: ad.nonce,
        signature: ad.signature,
        txid: ad.txid
      }))
    })

    it('throws if txid is missing', async () => {
      const ad: Advertisement = {
        identityKey: 'pubkey',
        host: 'http://host',
        timestamp: 1234567890,
        nonce: 'abc123',
        signature: 'sig'
        // txid intentionally omitted
      }

      const storage = createStorage()
      await expect(storage.storeAdvertisement(ad)).rejects.toThrow('Cannot store advertisement without txid.')
    })
  })

  describe('getLatestHostFor', () => {
    it('returns host if record exists', async () => {
      mockFirst.mockResolvedValueOnce({ host: 'http://host' })

      const storage = createStorage()
      const host = await storage.getLatestHostFor('someKey')

      expect(mockWhere).toHaveBeenCalledWith({ identity_key: 'someKey' })
      expect(host).toBe('http://host')
    })

    it('returns null if no record found', async () => {
      mockFirst.mockResolvedValueOnce(undefined)

      const storage = createStorage()
      const host = await storage.getLatestHostFor('unknownKey')

      expect(host).toBeNull()
    })
  })

  describe('listRecentAds', () => {
    it('returns the most recent ads', async () => {
      const dbRows = [
        { identity_key: 'a' },
        { identity_key: 'b' }
      ]
      mockLimit.mockResolvedValueOnce(dbRows)

      const storage = createStorage()
      const result = await storage.listRecentAds(2)

      expect(mockOrderBy).toHaveBeenCalledWith('created_at', 'desc')
      expect(mockLimit).toHaveBeenCalledWith(2)

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ identityKey: 'a' }),
          expect.objectContaining({ identityKey: 'b' })
        ])
      )
    })
  })
})

/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  advertisementTxId,
  createAdvertisementTx,
  broadcastAdvertisement
} from '../../utils/advertiserIntegration.js'
import { TopicBroadcaster, WalletInterface } from '@bsv/sdk'
import { Advertisement } from '../../utils/advertiser.js'

// Mock dependencies
jest.mock('@bsv/sdk', () => {
  const actual = jest.requireActual('@bsv/sdk')
  return {
    ...actual,
    TopicBroadcaster: jest.fn().mockImplementation(() => ({
      broadcast: jest.fn().mockResolvedValue({ status: 'success', txid: 'test-txid' })
    })),
    Transaction: jest.fn().mockImplementation(() => ({
      version: 1,
      lockTime: 0,
      inputs: [],
      outputs: [],
      toBEEF: jest.fn(),
      id: undefined
    }))
  }
})

jest.mock('../../utils/advertiser.js', () => ({
  createAdvertisement: jest.fn().mockResolvedValue({
    protocol: 'MB_AD',
    version: '1.0',
    identityKey: 'testKey',
    host: 'https://example.com',
    timestamp: new Date().toISOString(),
    nonce: 'nonce',
    signature: 'signature'
  })
}))

jest.mock('../../index.js', () => ({
  knex: jest.fn(() => ({
    insert: jest.fn().mockResolvedValue(undefined)
  }))
}))

describe('advertiserIntegration', () => {
  describe('advertisementTxId', () => {
    it('returns hex string if "hex" is passed', () => {
      const result = advertisementTxId('hex')
      expect(result).toBe('advertisementTxId')
    })

    it('returns number[] if no arg is passed', () => {
      const result = advertisementTxId()
      expect(Array.isArray(result)).toBe(true)
      expect(typeof result[0]).toBe('number')
    })
  })

  describe('createAdvertisementTx', () => {
    it('creates a Transaction with correct BEEF payload', () => {
      const ad: Advertisement = {
        protocol: 'MB_AD',
        version: '1.0',
        identityKey: 'key',
        host: 'https://host',
        timestamp: new Date().toISOString(),
        nonce: '123',
        signature: 'sig'
      }

      const tx = createAdvertisementTx(ad)
      expect(tx.version).toBe(1)
      expect(tx.lockTime).toBe(0)
      expect(tx.inputs).toEqual([])
      expect(tx.outputs).toEqual([])
      expect(typeof tx.toBEEF).toBe('function')
      expect(tx.id()).toEqual(advertisementTxId())
    })
  })

  describe('broadcastAdvertisement', () => {
    it('should broadcast and return success response', async () => {
      const mockWallet = {
        getPublicKey: jest.fn().mockResolvedValue({ publicKey: 'mocked-key' })
      } as unknown as WalletInterface

      const result = await broadcastAdvertisement({
        host: 'https://example.com',
        identityKey: 'testKey',
        privateKey: 'secret',
        wallet: mockWallet
      })

      expect(result.status).toBe('success')
      expect(result.txid).toBe('test-txid')
      expect(result.advertisement).toBeDefined()
      expect(result.requestBody).toContain('"identityKey":"testKey"')
    })

    it('should handle broadcast failure gracefully', async () => {
      const mockWallet = {
        getPublicKey: jest.fn().mockResolvedValue({ publicKey: 'mocked-key' })
      } as unknown as WalletInterface

      const broadcaster = {
        broadcast: jest.fn().mockRejectedValue(new Error('Broadcast failed'))
      } as unknown as TopicBroadcaster

      const result = await broadcastAdvertisement({
        host: 'https://example.com',
        identityKey: 'testKey',
        privateKey: 'secret',
        wallet: mockWallet,
        broadcaster
      })

      expect(result.status).toBe('error')
      expect(result.description).toMatch(/Broadcast failed/)
      expect(result.advertisement).toBeDefined()
    })
  })
})

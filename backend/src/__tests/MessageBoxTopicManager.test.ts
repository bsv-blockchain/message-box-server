import { MessageBoxTopicManager } from '../topic-managers/MessageBoxTopicManager.js'
import { MessageBoxStorage } from '../MessageBoxStorage.js'
import * as advertiserUtils from '../utils/advertiserIntegration.js'
import type { Advertisement } from '../types.js'

jest.mock('../MessageBoxStorage')
jest.mock('../../../utils/advertiserIntegration')

// Use a clean mock of MessageBoxStorage and the broadcaster
const mockedStorage = MessageBoxStorage
const mockedBroadcast = jest.spyOn(advertiserUtils, 'broadcastAdvertisement')

type ExtendedAd = Advertisement & {
  protocol: string
  version: string
}

describe('MessageBoxTopicManager', () => {
  const dummyAd: ExtendedAd = {
    identityKey: 'key1',
    host: 'http://host1',
    timestamp: new Date().toISOString(),
    nonce: '123abc',
    signature: 'signature',
    txid: 'txid-xyz',
    protocol: 'MB_AD',
    version: '1.0'
  }

  const dummyResponse = {
    status: 'success',
    advertisement: dummyAd,
    txid: dummyAd.txid
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockedBroadcast.mockResolvedValue(dummyResponse as any)

    jest
      .spyOn(mockedStorage.prototype, 'storeAdvertisement')
      .mockResolvedValue(undefined)

    jest
      .spyOn(mockedStorage.prototype, 'listRecentAds')
      .mockResolvedValue([dummyAd])
  })

  describe('broadcast()', () => {
    it('should call broadcastAdvertisement and store the result', async () => {
      const result = await MessageBoxTopicManager.broadcast()

      expect(mockedBroadcast).toHaveBeenCalled()

      expect(mockedStorage.prototype.storeAdvertisement).toHaveBeenCalledWith(expect.objectContaining({
        identityKey: dummyAd.identityKey,
        host: dummyAd.host,
        timestamp: expect.any(Date),
        nonce: dummyAd.nonce,
        signature: dummyAd.signature,
        txid: dummyAd.txid
      }))

      expect(result).toMatchObject({
        txid: dummyAd.txid,
        advertisement: expect.objectContaining({
          identityKey: dummyAd.identityKey,
          host: dummyAd.host,
          nonce: dummyAd.nonce,
          signature: dummyAd.signature,
          txid: dummyAd.txid,
          timestamp: expect.any(String)
        })
      })
    })

    it('throws an error if txid is missing', async () => {
      mockedBroadcast.mockResolvedValueOnce({
        advertisement: {
          protocol: dummyAd.protocol,
          version: dummyAd.version,
          identityKey: dummyAd.identityKey,
          host: dummyAd.host,
          timestamp: new Date().toISOString(),
          nonce: dummyAd.nonce,
          signature: dummyAd.signature
        },
        txid: undefined,
        status: 'success'
      } as any)

      await expect(MessageBoxTopicManager.broadcast()).rejects.toThrow('Missing txid in result.')
    })

    it('throws an error if advertisement is missing', async () => {
      mockedBroadcast.mockResolvedValueOnce({
        advertisement: undefined,
        txid: 'txid-xyz',
        status: 'success'
      } as any)

      await expect(MessageBoxTopicManager.broadcast()).rejects.toThrow('Missing advertisement payload in result.')
    })
  })

  describe('rebroadcast()', () => {
    it('should call broadcast()', async () => {
      const result = await MessageBoxTopicManager.rebroadcast()

      expect(result).toMatchObject({
        txid: dummyAd.txid,
        advertisement: expect.objectContaining({
          identityKey: dummyAd.identityKey,
          host: dummyAd.host,
          nonce: dummyAd.nonce,
          signature: dummyAd.signature,
          txid: dummyAd.txid,
          timestamp: expect.any(String)
        })
      })
    })
  })

  describe('listRecentAds()', () => {
    it('should return a list of recent ads', async () => {
      const ads = await MessageBoxTopicManager.listRecentAds(5)
      expect(mockedStorage.prototype.listRecentAds).toHaveBeenCalledWith(5)
      expect(ads).toEqual([dummyAd])
    })
  })
})

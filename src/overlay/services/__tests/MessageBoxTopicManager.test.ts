import { MessageBoxTopicManager } from '../MessageBoxTopicManager.js'
import { MessageBoxStorage } from '../MessageBoxStorage.js'
import { broadcastAdvertisement } from '../../../utils/advertiserIntegration.js'
import type { Advertisement } from '../../types.js'

jest.mock('../MessageBoxStorage')
jest.mock('../../../utils/advertiserIntegration')

const mockedStorage = MessageBoxStorage
const mockedBroadcast = broadcastAdvertisement as jest.Mock

describe('MessageBoxTopicManager', () => {
  const dummyAd: Advertisement = {
    identityKey: 'key1',
    host: 'http://host1',
    timestamp: Date.now(),
    nonce: '123abc',
    signature: 'signature',
    txid: 'txid-xyz'
  }

  const dummyResponse = {
    advertisement: dummyAd,
    txid: dummyAd.txid
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockedBroadcast.mockResolvedValue(dummyResponse)

    jest.spyOn(mockedStorage.prototype, 'storeAdvertisement').mockResolvedValue(undefined)
    jest.spyOn(mockedStorage.prototype, 'listRecentAds').mockResolvedValue([dummyAd])
  })

  describe('broadcast()', () => {
    it('should call broadcastAdvertisement and store the result', async () => {
      const result = await MessageBoxTopicManager.broadcast()

      expect(mockedBroadcast).toHaveBeenCalled()
      expect(mockedStorage.prototype.storeAdvertisement).toHaveBeenCalledWith(expect.objectContaining({
        identityKey: dummyAd.identityKey,
        host: dummyAd.host,
        timestamp: dummyAd.timestamp,
        nonce: dummyAd.nonce,
        signature: dummyAd.signature,
        txid: dummyAd.txid
      }))
      expect(result).toEqual({
        advertisement: dummyAd,
        txid: dummyAd.txid
      })
    })

    it('throws an error if txid is missing', async () => {
      mockedBroadcast.mockResolvedValueOnce({
        advertisement: { ...dummyAd, txid: undefined },
        txid: undefined
      })

      await expect(MessageBoxTopicManager.broadcast()).rejects.toThrow('Missing txid in result.')
    })

    it('throws an error if advertisement is missing', async () => {
      mockedBroadcast.mockResolvedValueOnce({ advertisement: undefined, txid: 'txid-xyz' })

      await expect(MessageBoxTopicManager.broadcast()).rejects.toThrow('Missing advertisement payload in result.')
    })
  })

  describe('rebroadcast()', () => {
    it('should call broadcast()', async () => {
      const result = await MessageBoxTopicManager.rebroadcast()
      expect(result).toEqual({
        advertisement: dummyAd,
        txid: dummyAd.txid
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

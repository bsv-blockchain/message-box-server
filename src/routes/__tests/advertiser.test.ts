/* eslint-env jest */
import { createAdvertisement } from '../../utils/advertiser.js'
import { createNonce, ECDSA, WalletInterface, Signature } from '@bsv/sdk'

// Mock the SDK functions to control their behavior.
jest.mock('@bsv/sdk', () => {
  const originalModule = jest.requireActual('@bsv/sdk')
  return {
    ...originalModule,
    createNonce: jest.fn(),
    ECDSA: {
      ...originalModule.ECDSA,
      sign: jest.fn()
    }
  }
})

describe('advertiser module', () => {
  const dummyWallet = {} as unknown as WalletInterface

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('canonicalize', () => {
    it('should produce a stable, sorted JSON string', async () => {
      const adData = {
        host: 'https://example.com',
        identityKey: 'key123',
        nonce: 'nonceVal',
        protocol: 'MB_AD',
        timestamp: '2025-04-01T12:00:00Z',
        version: '1.0'
      }

      const dummySig = {
        toDER: () => 'dummySignature'
      } as unknown as Signature

      ;(ECDSA.sign as jest.Mock).mockReturnValue(dummySig)

      const fixedTimestamp = '2025-04-01T12:00:00.000Z'
      const OriginalDate = Date
      global.Date = class extends Date {
        constructor () {
          super()
          return new OriginalDate(fixedTimestamp)
        }
      } as any

      const ad = await createAdvertisement({
        host: adData.host,
        identityKey: adData.identityKey,
        nonce: adData.nonce,
        wallet: dummyWallet
      })

      expect(ad.protocol).toBe('MB_AD')
      expect(ad.version).toBe('1.0')
      expect(ad.timestamp).toBe(fixedTimestamp)
      global.Date = OriginalDate
    })
  })

  describe('signMessage behavior', () => {
    it('should return a string if ECDSA.sign returns a Signature with toDER("hex")', async () => {
      const dummySig = {
        toDER: () => 'signatureString'
      } as unknown as Signature
      ;(ECDSA.sign as jest.Mock).mockReturnValue(dummySig)
      const result = await createAdvertisement({
        host: 'https://example.com',
        identityKey: 'key123',
        nonce: 'providedNonce',
        wallet: dummyWallet
      })
      expect(result.signature).toBe('signatureString')
    })

    it('should convert an array signature to a hex string', async () => {
      ;(ECDSA.sign as jest.Mock).mockReturnValue({
        toDER: (enc?: 'hex' | 'base64') => enc === 'hex' ? '010fff' : [1, 15, 255]
      })
      const ad = await createAdvertisement({
        host: 'https://example.com',
        identityKey: 'key123',
        nonce: 'providedNonce',
        wallet: dummyWallet
      })
      expect(ad.signature).toBe('010fff')
    })

    it('should throw an error if ECDSA.sign returns an unexpected type', async () => {
      ;(ECDSA.sign as jest.Mock).mockReturnValue({
        toDER: () => 12345 // Not a string or array
      })
      await expect(
        createAdvertisement({
          host: 'https://example.com',
          identityKey: 'key123',
          nonce: 'providedNonce',
          wallet: dummyWallet
        })
      ).rejects.toThrow('Unexpected signature type')
    })
  })

  describe('createAdvertisement nonce handling', () => {
    it('should use the provided nonce if non-empty', async () => {
      ;(ECDSA.sign as jest.Mock).mockReturnValue({
        toDER: () => 'dummySignature'
      } as unknown as Signature)
      const ad = await createAdvertisement({
        host: 'https://example.com',
        identityKey: 'key123',
        nonce: 'providedNonce',
        wallet: dummyWallet
      })
      expect(ad.nonce).toBe('providedNonce')
      expect(createNonce).not.toHaveBeenCalled()
    })

    it('should call createNonce if provided nonce is empty', async () => {
      ;(createNonce as jest.Mock).mockResolvedValue('generatedNonce')
      ;(ECDSA.sign as jest.Mock).mockReturnValue({
        toDER: () => 'dummySignature'
      } as unknown as Signature)
      const ad = await createAdvertisement({
        host: 'https://example.com',
        identityKey: 'key123',
        nonce: '  ',
        wallet: dummyWallet
      })
      expect(createNonce).toHaveBeenCalledWith(dummyWallet)
      expect(ad.nonce).toBe('generatedNonce')
    })
  })

  describe('createAdvertisement timestamp', () => {
    it('should produce a valid ISO timestamp', async () => {
      ;(ECDSA.sign as jest.Mock).mockReturnValue({
        toDER: () => 'dummySignature'
      } as unknown as Signature)
      const ad = await createAdvertisement({
        host: 'https://example.com',
        identityKey: 'key123',
        nonce: 'providedNonce',
        wallet: dummyWallet
      })
      expect(Date.parse(ad.timestamp)).not.toBeNaN()
    })
  })
})

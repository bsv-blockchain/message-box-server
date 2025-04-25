import type { Advertisement } from '../../../backend/src/overlay/types.js'

export const baseMockAd = {
  identityKey: 'mock-key',
  host: 'http://localhost:3000',
  nonce: 'mock-nonce',
  signature: 'mock-signature',
  txid: 'mock-txid',
  protocol: 'MB_AD',
  version: '1.0'
}

export const mockAd = (): Advertisement => ({
  ...baseMockAd,
  timestamp: new Date().toISOString()
})

export async function broadcastAdvertisement(): Promise<{
  advertisement: Advertisement
  txid: string
}> {
  const ad = mockAd()
  return {
    advertisement: ad,
    txid: ad.txid ?? 'default-txid'
  }
}

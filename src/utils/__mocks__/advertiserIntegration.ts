import type { Advertisement } from '../../overlay/types.js'

export const mockAd: Advertisement = {
  identityKey: 'mock-key',
  host: 'http://localhost:3000',
  timestamp: Math.floor(Date.now() / 1000),
  nonce: 'mock-nonce',
  signature: 'mock-signature',
  txid: 'mock-txid'
}

export async function broadcastAdvertisement (): Promise<{
  advertisement: Advertisement
  txid: string
}> {
  return {
    advertisement: mockAd,
    txid: mockAd.txid ?? 'default-txid'
  }
}

import {
  createNonce,
  WalletInterface
} from '@bsv/sdk'

export interface Advertisement {
  protocol: string
  version: string
  identityKey: string
  host: string
  timestamp: string
  nonce: string
  signature: string
}

/**
 * Canonicalizes the advertisement data.
 * Uses JSON.stringify with sorted keys.
 */
function canonicalize (data: Omit<Advertisement, 'signature'>): string {
  const sortedKeys = Object.keys(data).sort()
  const sortedData: Record<string, string> = {}
  for (const key of sortedKeys) {
    sortedData[key] = data[key as keyof typeof data]
  }
  return JSON.stringify(sortedData)
}

/**
 * Creates an advertisement message with a cryptographic signature using WalletInterface.
 */
export async function createAdvertisement ({
  host,
  identityKey,
  nonce,
  wallet
}: {
  host: string
  identityKey: string
  nonce?: string
  wallet: WalletInterface
}): Promise<Advertisement> {
  const protocol = 'MB_AD'
  const version = '1.0'
  const timestamp = new Date().toISOString()

  const resolvedNonce =
    nonce != null && nonce.trim() !== ''
      ? nonce
      : await createNonce(wallet)

  const advertisementData: Omit<Advertisement, 'signature'> = {
    protocol,
    version,
    identityKey,
    host,
    timestamp,
    nonce: resolvedNonce
  }

  const canonicalMessage = canonicalize(advertisementData)
  const messageBytes = Array.from(new TextEncoder().encode(canonicalMessage))

  const signatureResult = await wallet.createSignature({
    data: messageBytes,
    protocolID: [0, 'messageboxauth'],
    keyID: 'auth',
    counterparty: 'anyone'
  })

  const signatureHex = signatureResult.signature
    .map(n => n.toString(16).padStart(2, '0'))
    .join('')

  return {
    ...advertisementData,
    signature: signatureHex
  }
}

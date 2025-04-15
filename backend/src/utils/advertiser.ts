import {
  createNonce,
  WalletInterface
} from '@bsv/sdk'

/**
 * Represents a signed advertisement on the overlay network.
 * Used to associate a user's identity key with a host URL.
 */
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
 * Converts the input object into a JSON string with sorted keys
 * to ensure deterministic signing.
 *
 * @param data - Advertisement data excluding the signature
 * @returns Canonicalized string
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
 * Creates a signed advertisement that can be broadcast on the overlay.
 *
 * @param host - The URL of the host being advertised
 * @param identityKey - The user's identity key signing the advertisement
 * @param nonce - Optional nonce (will generate one if omitted)
 * @param wallet - Wallet interface used to sign the advertisement
 * @returns Advertisement object with signature
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

  // Use provided nonce or generate a new one
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

  // Canonicalize and encode the advertisement data
  const canonicalMessage = canonicalize(advertisementData)
  const messageBytes = Array.from(new TextEncoder().encode(canonicalMessage))

  const signatureResult = await wallet.createSignature({
    data: messageBytes,
    protocolID: [0, 'messageboxauth'],
    keyID: 'auth',
    counterparty: 'anyone'
  })

  // Normalize signature to hex string
  let signatureHex: string
  const sig = signatureResult.signature

  if (typeof sig === 'string') {
    signatureHex = sig
  } else if (Array.isArray(sig)) {
    signatureHex = sig.map(n => n.toString(16).padStart(2, '0')).join('')
  } else {
    throw new Error('Unexpected signature type')
  }

  // Return the full signed advertisement
  return {
    ...advertisementData,
    signature: signatureHex
  }
}

import {
  createNonce,
  ECDSA,
  BigNumber,
  Hash,
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
* Signs a message using the SDK's ECDSA signing function.
*/
async function signMessage (message: string, privateKey: string): Promise<string> {
  const messageHash = Hash.sha256(message)
  const msgBigNumber = new BigNumber(messageHash, 16)
  const privKeyBigNumber = new BigNumber(privateKey, 16)

  // Sign the message using ECDSA
  const signature = ECDSA.sign(msgBigNumber, privKeyBigNumber)

  const der = signature.toDER?.('hex')
  if (typeof der === 'string') {
    return der
  } else if (Array.isArray(der)) {
    return der.map(n => n.toString(16).padStart(2, '0')).join('')
  } else {
    throw new Error('Unexpected signature type')
  }
}

/**
* Creates an advertisement message with a cryptographic signature.
*/
export async function createAdvertisement ({
  host,
  identityKey,
  privateKey,
  nonce,
  wallet
}: {
  host: string
  identityKey: string
  privateKey: string
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
  const signature = await signMessage(canonicalMessage, privateKey)

  return {
    ...advertisementData,
    signature
  }
}

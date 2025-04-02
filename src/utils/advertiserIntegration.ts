import { createAdvertisement, Advertisement } from './advertiser.js'
import { TopicBroadcaster, Transaction } from '@bsv/sdk'
import type { WalletInterface } from '@bsv/sdk'
import { TextEncoder } from 'util'

// IMPORTANT: If you're using the same knex instance from index.ts,
// you can import it directly from there (recommended):
import { knex as globalKnex } from '../index.js'

export function advertisementTxId (): number[]
export function advertisementTxId (enc: 'hex'): string
export function advertisementTxId (enc?: 'hex'): string | number[] {
  if (enc === 'hex') {
    return 'advertisementTxId'
  }
  return Array.from(new TextEncoder().encode('advertisementTxId'))
}

export function createAdvertisementTx (ad: Advertisement): Transaction {
  const tx = new Transaction()
  tx.version = 1
  tx.lockTime = 0
  tx.inputs = []
  tx.outputs = []

  // Custom lightweight BEEF payload for advertisement broadcasting
  tx.toBEEF = function (): number[] {
    const adJSON = JSON.stringify(ad)
    const encoded = new TextEncoder().encode(adJSON)
    console.log('[createAdvertisementTx] toBEEF encoded JSON:', adJSON)
    console.log('[createAdvertisementTx] toBEEF Uint8Array:', encoded)
    return Array.from(encoded) // Converts Uint8Array to number[]
  }

  tx.id = advertisementTxId
  return tx
}

/**
 * Sends an advertisement over the overlay network using TopicBroadcaster.
 * Accepts optional broadcaster for test overrides.
 */
export async function broadcastAdvertisement ({
  host,
  identityKey,
  privateKey,
  wallet,
  topics = ['tm_messagebox_ad'],
  broadcaster
}: {
  host: string
  identityKey: string
  privateKey: string
  wallet: WalletInterface
  topics?: string[]
  broadcaster?: TopicBroadcaster
}): Promise<{
    status: string
    txid?: string
    code?: string
    description?: string
    requestBody?: string
    advertisement: Advertisement
  }> {
  const finalBroadcaster = broadcaster ?? new TopicBroadcaster(topics)

  const advertisement = await createAdvertisement({
    host,
    identityKey,
    privateKey,
    wallet
  })

  const advertisementTx = createAdvertisementTx(advertisement)

  console.log('[broadcastAdvertisement] Advertisement JSON:', advertisement)
  console.log('[broadcastAdvertisement] Transaction to be broadcast:', advertisementTx)

  // Store the advertisement in the database
  try {
    await globalKnex('overlay_ads').insert({
      identityKey: advertisement.identityKey,
      host: advertisement.host,
      nonce: advertisement.nonce,
      signature: advertisement.signature,
      timestamp: new Date(advertisement.timestamp),
      created_at: new Date()
    })
    console.log('[broadcastAdvertisement] Stored advertisement in DB.')
  } catch (dbError) {
    console.error('[broadcastAdvertisement] Failed to store advertisement in DB:', dbError)
  }

  let result
  try {
    result = await finalBroadcaster.broadcast(advertisementTx)
    console.log('[broadcastAdvertisement] Broadcast result:', result)
  } catch (err: any) {
    console.log('[broadcastAdvertisement] Broadcast error:', err)
    return {
      status: 'error',
      code: err?.code ?? 'UNKNOWN_ERROR',
      description: err?.message ?? String(err),
      advertisement
    }
  }

  return {
    ...result,
    requestBody: JSON.stringify(advertisement),
    advertisement
  }
}

import { createAdvertisement, Advertisement } from './advertiser.js'
import { TopicBroadcaster, Transaction } from '@bsv/sdk'
import type { WalletInterface } from '@bsv/sdk'
import { TextEncoder } from 'util'

import { knex as globalKnex } from '../app.js'

/**
 * Generates a deterministic transaction ID for advertisement transactions.
 * If called with 'hex', returns a string identifier for display/logging purposes.
 * Otherwise, returns a Uint8Array as an array of numbers.
 *
 * @param enc - Optional encoding type ('hex')
 * @returns Transaction ID as a string or array of bytes
 */
export function advertisementTxId (): number[]
export function advertisementTxId (enc: 'hex'): string
export function advertisementTxId (enc?: 'hex'): string | number[] {
  if (enc === 'hex') {
    return 'advertisementTxId'
  }
  return Array.from(new TextEncoder().encode('advertisementTxId'))
}

/**
 * Creates a BSV transaction with a custom `toBEEF()` method
 * that encodes the advertisement JSON payload as bytes.
 * This transaction is used for broadcasting to the overlay network.
 *
 * @param ad - Advertisement object
 * @returns Custom transaction with embedded advertisement data
 */
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
    return Array.from(encoded)
  }

  tx.id = advertisementTxId
  return tx
}

/**
 * Creates, signs, stores, and broadcasts an advertisement transaction
 * over the overlay network using TopicBroadcaster. Optionally allows test
 * injection of a broadcaster instance.
 *
 * @param host - The host address being advertised
 * @param identityKey - The user's identity key signing the advertisement
 * @param wallet - Wallet used to sign the advertisement
 * @param topics - Optional SHIP topics to publish to
 * @param broadcaster - Optional broadcaster override for testing
 * @returns Status, optional error info, and the advertisement
 */
export async function broadcastAdvertisement ({
  host,
  identityKey,
  wallet,
  topics = ['tm_messagebox_ad'],
  broadcaster
}: {
  host: string
  identityKey: string
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
    wallet
  })

  const advertisementTx = createAdvertisementTx(advertisement)
  const txid = advertisementTx.id('hex')

  console.log('[broadcastAdvertisement] Advertisement JSON:', advertisement)
  console.log('[broadcastAdvertisement] Transaction to be broadcast:', advertisementTx)

  // Store the advertisement in the database
  try {
    await globalKnex('overlay_ads').insert({
      txid,
      identity_key: advertisement.identityKey,
      host: advertisement.host,
      nonce: advertisement.nonce,
      signature: advertisement.signature,
      timestamp: new Date(advertisement.timestamp).toISOString().slice(0, 19).replace('T', ' '),
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

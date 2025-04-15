import { Knex } from 'knex'
import type { OverlayAdRow, Advertisement } from '../types.js'

/**
 * MessageBoxStorage is responsible for persisting and retrieving advertisement data
 * from the `overlay_ads` table. It provides functionality to resolve the most recent
 * host for a given identity key and manage advertisement history.
 */
export class MessageBoxStorage {
  constructor (private readonly knex: Knex) {}

  /**
   * Retrieves the most recently anointed host for a specific identity key
   * from the `overlay_ads` table.
   *
   * @param identityKey - The identity key to look up.
   * @returns The most recent host URL or null if none is found.
   */
  async getLatestHostFor (identityKey: string): Promise<string | null> {
    const record = await this.knex<OverlayAdRow>('overlay_ads')
      .where({ identitykey: identityKey })
      .orderBy('created_at', 'desc')
      .first()

    return record?.host ?? null
  }

  /**
   * Stores a new advertisement in the `overlay_ads` table.
   *
   * @param ad - An object containing identity key, host, timestamp, nonce, signature, and txid.
   * @throws If the advertisement is missing a `txid`.
   */
  async storeAdvertisement (ad: {
    identityKey: string
    host: string
    timestamp: string | Date
    nonce: string
    signature: string
    txid?: string
  }): Promise<void> {
    if (ad.txid == null || ad.txid.trim() === '') {
      throw new Error('Cannot store advertisement without txid.')
    }

    await this.knex('overlay_ads').insert({
      identitykey: ad.identityKey,
      host: ad.host,
      timestamp: new Date(ad.timestamp),
      nonce: ad.nonce,
      signature: ad.signature,
      txid: ad.txid,
      created_at: new Date()
    })
  }

  /**
   * Retrieves a list of the most recent advertisements stored in the `overlay_ads` table.
   *
   * @param limit - The maximum number of advertisements to return. Default is 20.
   * @returns A list of recent Advertisement objects.
   */
  async listRecentAds (limit = 20): Promise<Advertisement[]> {
    const rows = await this.knex<OverlayAdRow>('overlay_ads')
      .orderBy('created_at', 'desc')
      .limit(limit)

    return rows.map(row => ({
      identityKey: row.identitykey,
      host: row.host,
      timestamp: row.timestamp.toString(),
      nonce: row.nonce,
      signature: row.signature,
      txid: row.txid,
      created_at: row.created_at,
      protocol: 'MBSERVEAD',
      version: '1.0'
    }))
  }
}

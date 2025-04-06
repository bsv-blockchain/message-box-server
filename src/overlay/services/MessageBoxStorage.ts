import { Knex } from 'knex'
import type { OverlayAdRow, Advertisement } from '../types.js'

export class MessageBoxStorage {
  constructor (private readonly knex: Knex) {}

  async getLatestHostFor (identityKey: string): Promise<string | null> {
    const record = await this.knex<OverlayAdRow>('overlay_ads')
      .where({ identity_key: identityKey })
      .orderBy('created_at', 'desc')
      .first()

    return record?.host ?? null
  }

  async storeAdvertisement (ad: {
    identityKey: string
    host: string
    timestamp: number
    nonce: string
    signature: string
    txid?: string
  }): Promise<void> {
    if (ad.txid == null || ad.txid.trim() === '') {
      throw new Error('Cannot store advertisement without txid.')
    }

    await this.knex('overlay_ads').insert({
      identity_key: ad.identityKey,
      host: ad.host,
      timestamp: ad.timestamp,
      nonce: ad.nonce,
      signature: ad.signature,
      txid: ad.txid,
      created_at: new Date()
    })
  }

  async listRecentAds (limit = 20): Promise<Advertisement[]> {
    const rows = await this.knex<OverlayAdRow>('overlay_ads')
      .orderBy('created_at', 'desc')
      .limit(limit)

    // Convert snake_case → camelCase
    return rows.map(row => ({
      identityKey: row.identity_key,
      host: row.host,
      timestamp: row.timestamp,
      nonce: row.nonce,
      signature: row.signature,
      txid: row.txid,
      created_at: row.created_at
    }))
  }
}

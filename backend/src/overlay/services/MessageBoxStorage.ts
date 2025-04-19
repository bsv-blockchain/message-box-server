import knexModule from 'knex'
import type { Knex } from 'knex'
import knexConfig from './knexfile.js'

const createKnex = (knexModule as any).default ?? knexModule

function formatMySQLDate(date: string | Date): string {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ')
}

export class MessageBoxStorage {
  private readonly knex: Knex

  constructor(knexInstance?: Knex) {
    this.knex = knexInstance ?? createKnex(knexConfig.development)
  }

  /**
   * Stores a record received from a SHIP broadcast.
   * Called by outputAdded() in LookupService.
   */
  async storeRecord(
    identityKey: string,
    host: string,
    txid: string,
    outputIndex: number,
    timestamp: string,
    nonce: string,
    signature: string,
    raw_advertisement: object
  ): Promise<void> {
    await this.knex('overlay_ads').insert({
      identitykey: identityKey,
      host,
      txid,
      output_index: outputIndex,
      timestamp: formatMySQLDate(timestamp),
      nonce,
      signature,
      raw_advertisement: JSON.stringify(raw_advertisement),
      created_at: formatMySQLDate(new Date())
    })
  }

  async deleteRecord(txid: string, outputIndex: number): Promise<void> {
    await this.knex('overlay_ads')
      .where({ txid, output_index: outputIndex })
      .del()
  }

  async findHostsForIdentity(identityKey: string): Promise<string[]> {
    const rows = await this.knex('overlay_ads')
      .select('host')
      .where({ identitykey: identityKey })
      .orderBy('created_at', 'desc')

    return rows.map(row => row.host)
  }

  async findAll(): Promise<{ identityKey: string, host: string, timestamp?: string, nonce?: string }[]> {
    const rows = await this.knex('overlay_ads')
      .select('identitykey', 'host', 'timestamp', 'nonce')
      .orderBy('created_at', 'desc')

    return rows.map(row => ({
      identityKey: row.identitykey as string,
      host: row.host as string,
      timestamp: row.timestamp as string | undefined,
      nonce: row.nonce as string | undefined
    }))
  }

  async findRecent(limit = 10): Promise<{ identityKey: string, host: string, timestamp?: string, nonce?: string }[]> {
    const rows = await this.knex('overlay_ads')
      .select('identitykey', 'host', 'timestamp', 'nonce')
      .orderBy('created_at', 'desc')
      .limit(limit)

    return rows.map(row => ({
      identityKey: row.identitykey as string,
      host: row.host as string,
      timestamp: row.timestamp as string | undefined,
      nonce: row.nonce as string | undefined
    }))
  }
}

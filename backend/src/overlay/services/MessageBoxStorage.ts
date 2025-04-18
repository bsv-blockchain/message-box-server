import knexModule from 'knex'
import type { Knex } from 'knex'
import knexConfig from './knexfile.js'

// ✅ Correct way to grab the actual function
const createKnex = (knexModule as any).default ?? knexModule

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
    outputIndex: number
  ): Promise<void> {
    await this.knex('overlay_ads').insert({
      identitykey: identityKey,
      host,
      txid,
      output_index: outputIndex,
      created_at: new Date()
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

  async findAll(): Promise<{ identityKey: string, host: string }[]> {
    const rows = await this.knex('overlay_ads')
      .select('identitykey', 'host')
      .orderBy('created_at', 'desc')

    return rows.map(row => ({
      identityKey: row.identitykey,
      host: row.host
    }))
  }
}

import { Knex } from 'knex'

/**
 * MessageBoxStorage provides a SHIP-compatible storage engine
 * that maps identity keys to advertised hosts from overlay messages.
 */
export class MessageBoxStorage {
  constructor(private readonly knex: Knex) {}

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

  /**
   * Deletes a record when the corresponding output is spent or deleted.
   */
  async deleteRecord(txid: string, outputIndex: number): Promise<void> {
    await this.knex('overlay_ads')
      .where({ txid, output_index: outputIndex })
      .del()
  }

  /**
   * Finds all known host advertisements for a given identityKey.
   * Used in LookupService.lookup().
   */
  async findHostsForIdentity(identityKey: string): Promise<string[]> {
    const rows = await this.knex('overlay_ads')
      .select('host')
      .where({ identitykey: identityKey })
      .orderBy('created_at', 'desc')

    return rows.map(row => row.host)
  }

  /**
   * Optional: Find all identity-to-host mappings for debugging or discovery.
   */
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

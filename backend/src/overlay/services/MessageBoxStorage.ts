/**
 * MessageBox Storage Module
 * 
 * Provides a persistent database interface for storing and retrieving
 * MessageBox overlay advertisements using Knex and a MySQL-compatible database.
 * 
 * This class supports saving advertisements received via SHIP broadcasts,
 * as well as querying and cleaning up those records.
 * 
 * @module MessageBoxStorage
 */

import knexModule from 'knex'
import type { Knex } from 'knex'
import knexConfig from './knexfile.js'

const createKnex = (knexModule as any).default ?? knexModule

/**
 * Formats a Date or string timestamp into a MySQL-compatible datetime string.
 * 
 * @param date - A JavaScript `Date` or ISO string
 * @returns A formatted `YYYY-MM-DD HH:MM:SS` string
 */
function formatMySQLDate(date: string | Date): string {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * Handles all database operations for storing and querying MessageBox overlay advertisements.
 */
export class MessageBoxStorage {
  private readonly knex: Knex

   /**
   * Creates a new MessageBoxStorage instance using a given or default Knex instance.
   * 
   * @param knexInstance - An optional externally provided Knex instance.
   */
  constructor(knexInstance?: Knex) {
    this.knex = knexInstance ?? createKnex(knexConfig.development)
  }

  /**
   * Stores a new overlay advertisement record in the database.
   * 
   * @param identityKey - The identity key of the user advertising their MessageBox.
   * @param host - The host address of the MessageBox server.
   * @param txid - The transaction ID containing the advertisement.
   * @param outputIndex - The index of the output containing the ad in the transaction.
   * @param timestamp - The timestamp included in the ad.
   * @param nonce - A random string to prevent collisions.
   * @param signature - The hex-encoded signature over the advertisement fields.
   * @param raw_advertisement - The full decoded advertisement object.
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

  /**
   * Deletes an overlay advertisement by transaction ID and output index.
   * 
   * @param txid - The transaction ID of the ad.
   * @param outputIndex - The index of the ad output to delete.
   */
  async deleteRecord(txid: string, outputIndex: number): Promise<void> {
    await this.knex('overlay_ads')
      .where({ txid, output_index: outputIndex })
      .del()
  }

  /**
   * Finds all known host advertisements for a given identity key.
   * 
   * @param identityKey - The identity key to look up.
   * @returns An array of host strings ordered by recency.
   */
  async findHostsForIdentity(identityKey: string): Promise<string[]> {
    const rows = await this.knex('overlay_ads')
      .select('host')
      .where({ identitykey: identityKey })
      .orderBy('created_at', 'desc')

    return rows.map(row => row.host)
  }

  /**
   * Lists all stored advertisements in the database.
   * 
   * @returns An array of identity/host records, most recent first.
   */
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

  /**
   * Returns a limited number of the most recent overlay advertisements.
   * 
   * @param limit - Maximum number of records to return (default: 10).
   * @returns A list of the latest identity/host advertisement records.
   */
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

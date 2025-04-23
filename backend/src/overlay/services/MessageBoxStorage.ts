/**
 * MessageBox Storage Module
 * 
 * Provides a persistent database interface for storing and retrieving
 * MessageBox overlay advertisements using MongoDB.
 * 
 * This class supports saving advertisements received via SHIP broadcasts,
 * as well as querying and cleaning up those records.
 * 
 * @module MessageBoxStorage
 */

import { Collection, Db } from 'mongodb'

/**
 * Handles all database operations for storing and querying MessageBox overlay advertisements.
 */
export class MessageBoxStorage {
  private readonly adsCollection: Collection

  /**
   * Creates a new MessageBoxStorage instance.
   *
   * @param db - An initialized MongoDB `Db` instance.
   */
  constructor(db: Db) {
    this.adsCollection = db.collection('overlay_ads')
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
    await this.adsCollection.insertOne({
      identityKey,
      host,
      txid,
      outputIndex,
      timestamp,
      nonce,
      signature,
      raw_advertisement,
      createdAt: new Date()
    })
  }

  /**
   * Deletes an overlay advertisement by transaction ID and output index.
   * 
   * @param txid - The transaction ID of the ad.
   * @param outputIndex - The index of the ad output to delete.
   */
  async deleteRecord(txid: string, outputIndex: number): Promise<void> {
    await this.adsCollection.deleteOne({ txid, outputIndex })
  }

  /**
   * Finds all known host advertisements for a given identity key.
   * 
   * @param identityKey - The identity key to look up.
   * @returns An array of host strings ordered by recency.
   */
  async findHostsForIdentity(identityKey: string): Promise<string[]> {
    const cursor = this.adsCollection
      .find({ identityKey })
      .sort({ createdAt: -1 })
      .project({ host: 1 })

    const results = await cursor.toArray()
    return results.map(doc => doc.host)
  }

  /**
   * Lists all stored advertisements in the database.
   * 
   * @returns An array of identity/host records, most recent first.
   */
  async findAll(): Promise<{ identityKey: string, host: string, timestamp?: string, nonce?: string }[]> {
    const cursor = this.adsCollection.find({}).sort({ createdAt: -1 })
    const results = await cursor.toArray()

    return results.map(doc => ({
      identityKey: doc.identityKey,
      host: doc.host,
      timestamp: doc.timestamp,
      nonce: doc.nonce
    }))
  }

  /**
   * Returns a limited number of the most recent overlay advertisements.
   * 
   * @param limit - Maximum number of records to return (default: 10).
   * @returns A list of the latest identity/host advertisement records.
   */
  async findRecent(limit = 10): Promise<{ identityKey: string, host: string, timestamp?: string, nonce?: string }[]> {
    const cursor = this.adsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)

    const results = await cursor.toArray()
    return results.map(doc => ({
      identityKey: doc.identityKey,
      host: doc.host,
      timestamp: doc.timestamp,
      nonce: doc.nonce
    }))
  }
}


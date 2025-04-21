/**
 * MessageBox Lookup Service
 * 
 * Provides an implementation of a SHIP-compatible `LookupService` used to 
 * track and resolve overlay advertisements related to MessageBox hosts.
 * 
 * This service handles new overlay advertisement outputs by decoding PushDrop
 * data and storing them in a structured format. It supports host lookup
 * by identity key, enabling clients to discover where a user's MessageBox is hosted.
 * 
 * @module MessageBoxLookupService
 */

import {
  LookupService,
  LookupQuestion,
  LookupAnswer,
  LookupFormula
} from '@bsv/overlay'

import { MessageBoxStorage } from './MessageBoxStorage.js'
import { PushDrop, Script, Utils } from '@bsv/sdk'
import docs from './MessageBoxLookupDocs.md.js'
import { Knex } from 'knex'

/**
 * Implements the SHIP-compatible overlay `LookupService` for MessageBox advertisements.
 */
class MessageBoxLookupService implements LookupService {
  constructor(public storage: MessageBoxStorage) {}

  /**
   * Called when a new output is added that may contain an advertisement.
   * 
   * @param txid - The transaction ID of the output.
   * @param outputIndex - The index of the output within the transaction.
   * @param outputScript - The locking script of the output.
   * @param topic - The overlay topic associated with this output.
   */
  async outputAdded?(txid: string, outputIndex: number, outputScript: Script, topic: string): Promise<void> {
    if (topic !== 'tm_messagebox') return;
  
    try {
      const decoded = PushDrop.decode(outputScript);
      const [identityKeyBuf, hostBuf, timestampBuf, nonceBuf] = decoded.fields;
      const signatureBuf = decoded.fields.at(-1)!;
  
      const ad = {
        identityKey: Utils.toUTF8(identityKeyBuf),
        host: Utils.toUTF8(hostBuf),
        timestamp: Utils.toUTF8(timestampBuf),
        nonce: Utils.toUTF8(nonceBuf),
        signature: Utils.toHex(signatureBuf) // Store as hex
      };
  
      console.log('[LOOKUP] Decoded advertisement:', ad);
  
      await this.storage.storeRecord(
        ad.identityKey,
        ad.host,
        txid,
        outputIndex,
        ad.timestamp,
        ad.nonce,
        ad.signature,
        ad
      );
    } catch (e) {
      console.error('[LOOKUP ERROR] Failed to process outputAdded:', e);
    }
  }

  /**
   * Called when an output is spent and should be removed from the index.
   * 
   * @param txid - The transaction ID of the spent output.
   * @param outputIndex - The output index within the transaction.
   * @param topic - The topic indicating what type of output this was.
   */
  async outputSpent?(
    txid: string,
    outputIndex: number,
    topic: string
  ): Promise<void> {
    if (topic === 'tm_messagebox') {
      await this.storage.deleteRecord(txid, outputIndex)
    }
  }

  /**
   * Called when an output is explicitly deleted from the overlay index.
   * 
   * @param txid - The transaction ID of the deleted output.
   * @param outputIndex - The index of the deleted output.
   * @param topic - The topic this deletion applies to.
   */
  async outputDeleted?(
    txid: string,
    outputIndex: number,
    topic: string
  ): Promise<void> {
    if (topic === 'tm_messagebox') {
      await this.storage.deleteRecord(txid, outputIndex)
    }
  }

  /**
   * Resolves a lookup question by identity key and returns known hosts.
   * 
   * @param question - The lookup question to resolve.
   * @returns A `LookupAnswer` with the host information or a `LookupFormula` if dynamic.
   */
  async lookup(question: LookupQuestion): Promise<LookupAnswer | LookupFormula> {
    if (question.service !== 'lsmessagebox') {
      throw new Error('Unsupported lookup service')
    }

    const query = question.query as { identityKey: string }

    if (!query?.identityKey) {
      throw new Error('identityKey query missing')
    }

    const hosts = await this.storage.findHostsForIdentity(query.identityKey)

    return {
      type: 'freeform',
      result: { hosts }
    }
  }

  /**
   * Provides human-readable documentation for the service.
   * 
   * @returns A string containing the Markdown documentation.
   */
  async getDocumentation(): Promise<string> {
    return docs
  }

  /**
   * Returns metadata describing this overlay service.
   * 
   * @returns An object with service name, description, and optional UI metadata.
   */
  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'MessageBox Lookup Service',
      shortDescription: 'Lookup overlay hosts for identity keys (MessageBox)'
    }
  }
}

/**
 * Factory function used by LARS to register this lookup service.
 * 
 * @param knex - A configured Knex instance connected to the overlay database.
 * @returns A service object with a `LookupService` implementation and migrations array.
 */
export default (knex: Knex) => {
  return {
    service: new MessageBoxLookupService(new MessageBoxStorage(knex)),
    migrations: []                                                    
  }
}

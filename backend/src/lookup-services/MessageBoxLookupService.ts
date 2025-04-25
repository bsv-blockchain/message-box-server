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
import docs from '../lookup-services/MessageBoxLookupDocs.md.js'
import { Db } from 'mongodb'

/**
 * Implements the SHIP-compatible overlay `LookupService` for MessageBox advertisements.
 */
class MessageBoxLookupService implements LookupService {
  constructor(public storage: MessageBoxStorage) { }

  /**
  * Called when a new output is added that may contain an advertisement.
  * 
  * Expected PushDrop field order:
  * 1. identityKey (hex)
  * 2. host (string)
  * 3. timestamp (ISO string)
  * 4. nonce (string)
  * 5. signature (hex)
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
      const [identityKeyBuf, hostBuf] = decoded.fields;

      const ad = {
        identityKey: Utils.toHex(identityKeyBuf),
        host: Utils.toUTF8(hostBuf)
      };

      console.log('[LOOKUP] Decoded advertisement:', ad);

      await this.storage.storeRecord(
        ad.identityKey,
        ad.host,
        txid,
        outputIndex
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
  * Resolves a lookup question by identity key and returns known MessageBox host(s).
  * 
  * @param question - The lookup question to resolve. Must have `service` = 'ls_messagebox' and a valid `identityKey`.
  * @returns A `LookupAnswer` containing one or more host strings that the identity key has advertised.
  *          The answer format is `type: 'freeform'`, with result `{ hosts: string[] }`.
  */
  async lookup(question: LookupQuestion): Promise<LookupAnswer | LookupFormula> {
    if (question.service !== 'ls_messagebox') {
      throw new Error('Unsupported lookup service')
    }

    const query = question.query as { identityKey: string }

    if (!query?.identityKey) {
      throw new Error('identityKey query missing')
    }

    return await this.storage.findHostsForIdentity(query.identityKey)
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
 * @param mongoDb - A connected MongoDB database instance provided by LARS.
 * @returns A `MessageBoxLookupService` that handles overlay lookups for MessageBox.
 */
export default (mongoDb: Db): MessageBoxLookupService => {
  return new MessageBoxLookupService(new MessageBoxStorage(mongoDb))
}



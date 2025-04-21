import {
  LookupService,
  LookupQuestion,
  LookupAnswer,
  LookupFormula
} from '@bsv/overlay'

import { MessageBoxStorage } from './MessageBoxStorage.js'
import { ProtoWallet, PushDrop, Script, Utils } from '@bsv/sdk'
import docs from './MessageBoxLookupDocs.md.js'
import { Knex } from 'knex'
// import * as migration1 from '../../migrations/2022-12-28-001-initial-migration.js'
// import * as migration2 from '../../migrations/2025-04-01-001-create-overlay-ads.js'
// import * as migration3 from '../../migrations/2023-01-17-messages-update.js'
// import * as migration4 from '../../migrations/2024-03-05-001-messageID-upgrade.js'

/**
 * Implements a MessageBox overlay lookup service for use with SHIP
 */
class MessageBoxLookupService implements LookupService {
  constructor(public storage: MessageBoxStorage) {}

  /**
   * Notifies the lookup service of a new output added.
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

  async outputSpent?(
    txid: string,
    outputIndex: number,
    topic: string
  ): Promise<void> {
    if (topic === 'tm_messagebox') {
      await this.storage.deleteRecord(txid, outputIndex)
    }
  }

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
   * Answers a lookup query
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

  async getDocumentation(): Promise<string> {
    return docs
  }

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

// Default export is the factory function expected by LARS
export default (knex: Knex) => {
  return {
    service: new MessageBoxLookupService(new MessageBoxStorage(knex)),
    migrations: []                                                    
  }
}

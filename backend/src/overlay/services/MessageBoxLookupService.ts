import {
  LookupService,
  LookupQuestion,
  LookupAnswer,
  LookupFormula
} from '@bsv/overlay'

import { MessageBoxStorage } from './MessageBoxStorage.js'
import { Script } from '@bsv/sdk'
import docs from './MessageBoxLookupDocs.md.js'
import { Knex } from 'knex'

/**
 * Implements a MessageBox overlay lookup service for use with SHIP
 */
class MessageBoxLookupService implements LookupService {
  constructor(public storage: MessageBoxStorage) {}

  async outputAdded?(
    txid: string,
    outputIndex: number,
    outputScript: Script,
    topic: string
  ): Promise<void> {
    if (topic !== 'tm_messagebox') return
  
    function hasBuf(chunk: unknown): chunk is { buf: Uint8Array } {
      return (
        typeof chunk === 'object' &&
        chunk !== null &&
        'buf' in chunk &&
        chunk['buf'] instanceof Uint8Array
      )
    }
  
    try {
      const chunks = outputScript.chunks
  
      if (chunks.length < 2 || !hasBuf(chunks[1])) {
        console.warn('[SHIP] OP_RETURN script missing expected payload chunk.')
        return
      }
  
      const hex = Buffer.from(chunks[1].buf).toString()
      const json = JSON.parse(Buffer.from(hex, 'hex').toString('utf8'))
  
      const identityKey = json.identityKey
      const host = json.host
  
      if (!host || !identityKey) {
        console.warn(`[SHIP] Incomplete broadcast: host=${host}, key=${identityKey}`)
        return
      }
  
      await this.storage.storeRecord(identityKey, host, txid, outputIndex)
    } catch (e) {
      console.error('Error processing SHIP broadcast in MessageBox lookup:', e)
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
    migrations: [] // You can add migration objects here later if needed
  }
}

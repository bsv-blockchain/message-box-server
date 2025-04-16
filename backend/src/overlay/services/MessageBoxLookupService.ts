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
      return !!chunk && typeof chunk === 'object' && chunk !== null && 'buf' in chunk && chunk.buf instanceof Uint8Array
    }
    
    try {
      const chunks = outputScript.chunks
    
      const hostsChunk = chunks.find(c => hasBuf(c) && Buffer.from(c.buf).toString().includes('http'))
      const host = hostsChunk && hasBuf(hostsChunk) ? Buffer.from(hostsChunk.buf).toString() : null
    
      const keyChunk = chunks.find(c => hasBuf(c) && c.buf.length === 33)
      const identityKey = keyChunk && hasBuf(keyChunk) ? Buffer.from(keyChunk.buf).toString('hex') : null
    
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
export default (knex: Knex): MessageBoxLookupService => {
  return new MessageBoxLookupService(new MessageBoxStorage(knex))
}

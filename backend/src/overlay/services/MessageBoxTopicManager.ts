/**
 * MessageBox Topic Manager
 * 
 * Implements a TopicManager for the SHIP overlay system. This class validates
 * `tm_messagebox` advertisements to determine which outputs should be admitted
 * as valid MessageBox host records.
 * 
 * An advertisement is deemed admissible if its PushDrop-encoded fields contain:
 * - An identity key
 * - A host
 * - A timestamp
 * - A nonce
 * - A valid signature over [host + timestamp + nonce] from the identity key
 * 
 * @module MessageBoxTopicManager
 */

import { PushDrop, ProtoWallet, Utils, Transaction } from '@bsv/sdk'
import type { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import docs from './MessageBoxTopicDocs.md.js'

/**
 * Wallet used to verify advertisement signatures from anyone.
 */
const anyoneWallet = new ProtoWallet('anyone')

/**
 * Validates `tm_messagebox` outputs in SHIP transactions by checking signatures
 * and structure of PushDrop-encoded advertisements.
 */
export default class MessageBoxTopicManager implements TopicManager {
  /**
   * Verifies outputs from a transaction and determines which are admissible.
   * 
   * @param beef - The serialized transaction (AtomicBEEF) as a byte array.
   * @param previousCoins - Previous outputs to retain (not modified).
   * @returns A list of admissible outputs and retained coins.
   */
  async identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []
  
    const tx = Transaction.fromBEEF(beef)
  
    console.log(`[TOPIC MANAGER] Decoding transaction with ${tx.outputs.length} outputs`)
  
    for (const [i, output] of tx.outputs.entries()) {
      try {
        const result = PushDrop.decode(output.lockingScript)
        console.log(`[OUTPUT ${i}] PushDrop decoded fields count: ${result.fields.length + 1}`)
  
        // Extract signature (last field), and rest are data
        const signature = result.fields.pop() as number[]
        const [identityKeyBuf, hostBuf, timestampBuf, nonceBuf] = result.fields
  
        console.log(`[OUTPUT ${i}] Raw Buffers:`, {
          identityKeyBuf,
          hostBuf,
          timestampBuf,
          nonceBuf,
          signature
        })
  
        // Basic admissibility checks before processing
        if (
          !identityKeyBuf || !hostBuf || !timestampBuf || !nonceBuf ||
          identityKeyBuf.length === 0 || hostBuf.length === 0 ||
          timestampBuf.length === 0 || nonceBuf.length === 0
        ) {
          console.warn(`[ADMISSIBILITY] Output ${i} skipped due to empty field(s)`)
          continue
        }
  
        let host: string, timestamp: string, nonce: string
        try {
          host = Utils.toUTF8(hostBuf)
          timestamp = Utils.toUTF8(timestampBuf)
          nonce = Utils.toUTF8(nonceBuf)
  
          console.log(`[OUTPUT ${i}] Decoded strings:`, { host, timestamp, nonce })
  
          if (isNaN(Date.parse(timestamp))) {
            console.warn(`[ADMISSIBILITY] Output ${i} skipped due to invalid timestamp:`, timestamp)
            continue
          }
  
          if (nonce.length > 128) {
            console.warn(`[ADMISSIBILITY] Output ${i} skipped due to oversized nonce`)
            continue
          }
        } catch {
          console.warn(`[ADMISSIBILITY] Output ${i} skipped due to UTF-8 decoding failure`)
          continue
        }
  
        const identityKey = Utils.toUTF8(identityKeyBuf)
        const data = [...identityKeyBuf, ...hostBuf, ...timestampBuf, ...nonceBuf]
  
        console.log(`[OUTPUT ${i}] Verifying signature using:`, {
          identityKey,
          protocolID: [1, 'messagebox advertisement'],
          keyID: '1',
          data,
          signature
        })
  
        const { valid } = await anyoneWallet.verifySignature({
          data,
          signature,
          counterparty: identityKey,
          protocolID: [1, 'messagebox advertisement'],
          keyID: '1'
        })
  
        if (valid) {
          console.log(`[SIGNATURE] Output ${i} PASSED signature check`)
          outputsToAdmit.push(i)
        } else {
          console.warn(`[SIGNATURE] Output ${i} FAILED signature verification`)
        }
      } catch (e) {
        console.warn(`[DECODE ERROR] Skipping output ${i} due to exception:`, e)
      }
    }
  
    console.log(`[TOPIC MANAGER] Outputs to admit:`, outputsToAdmit)
  
    return {
      outputsToAdmit,
      coinsToRetain: previousCoins
    }
  }  

  /**
   * Returns a Markdown string with documentation for this topic manager.
   */
  async getDocumentation(): Promise<string> {
    return docs
  }

  /**
   * Returns metadata used by SHIP dashboards or discovery tools.
   */
  async getMetaData() {
    return {
      name: 'MessageBox Topic Manager',
      shortDescription: 'Advertises and validates hosts for message routing.'
    }
  }

  /**
   * Returns the topics supported by this TopicManager.
   */
  getTopics(): string[] {
    return ['tm_messagebox']
  }
}

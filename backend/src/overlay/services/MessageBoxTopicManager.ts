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

    for (const [i, output] of tx.outputs.entries()) {
      try {
        const result = PushDrop.decode(output.lockingScript)

        // Extract signature (last field), and rest are data
        const signature = result.fields.pop() as number[]
        const [identityKeyBuf, hostBuf, timestampBuf, nonceBuf] = result.fields

        const identityKey = Utils.toUTF8(identityKeyBuf)
        const host = Utils.toUTF8(hostBuf)
        const timestamp = Utils.toUTF8(timestampBuf)
        const nonce = Utils.toUTF8(nonceBuf)

        const data = [...hostBuf, ...timestampBuf, ...nonceBuf]

        const { valid } = await anyoneWallet.verifySignature({
          data,
          signature,
          counterparty: identityKey,
          protocolID: [0, 'MBSERVEAD'],
          keyID: '1'
        })

        if (valid) {
          outputsToAdmit.push(i)
        }
      } catch (e) {
        console.warn(`Skipping output ${i} due to decode/verify failure:`, e)
      }
    }

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

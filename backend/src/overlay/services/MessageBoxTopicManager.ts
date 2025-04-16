import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { Transaction, ProtoWallet, Utils } from '@bsv/sdk'
import docs from './MessageBoxTopicDocs.md.js'
import type { Advertisement } from '../types.js'

const anyoneWallet = new ProtoWallet('anyone')

/**
 * MessageBoxTopicManager handles validation of SHIP advertisements
 * on the `tm_messagebox` topic.
 */
export default class MessageBoxTopicManager implements TopicManager {
  /**
   * Validates SHIP advertisement outputs and determines which should be admitted.
   */
  async identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []

    try {
      const parsedTx = Transaction.fromBEEF(beef)

      for (const [i, output] of parsedTx.outputs.entries()) {
        try {
          const asm = output.lockingScript.toASM()
          const jsonStr = asm.split(' ').pop() ?? ''
          const ad = JSON.parse(jsonStr) as Advertisement

          if (
            typeof ad.identityKey !== 'string' || ad.identityKey.trim() === '' ||
            typeof ad.host !== 'string' || ad.host.trim() === '' ||
            typeof ad.signature !== 'string' || ad.signature.trim() === ''
          ) {
            continue
          }

          const isValid = await anyoneWallet.verifySignature({
            protocolID: [0, 'MBSERVEAD'],
            keyID: '1',
            counterparty: ad.identityKey,
            data: [
              ...Utils.toArray(ad.host, 'utf8'),
              ...Utils.toArray(ad.timestamp, 'utf8'),
              ...Utils.toArray(ad.nonce, 'utf8')
            ],
            signature: Utils.toArray(ad.signature, 'hex')
          })

          if (isValid.valid !== true) continue

          outputsToAdmit.push(i)
        } catch {
          continue // Ignore and skip malformed outputs
        }
      }
    } catch (err) {
      const beefStr = JSON.stringify(beef, null, 2)
      throw new Error(`Error validating outputs: ${err instanceof Error ? err.message : String(err)}\nBEEF:\n${beefStr}`)
    }

    return {
      outputsToAdmit,
      coinsToRetain: previousCoins
    }
  }

  /**
   * Provides markdown documentation for this overlay topic.
   */
  async getDocumentation(): Promise<string> {
    return docs
  }

  /**
   * Provides metadata for UI and overlay tooling.
   */
  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'MessageBox Topic Manager',
      shortDescription: 'Advertises and validates hosts for message routing.'
    }
  }  
  
  /**
  * Provides a list of topics that this manager is responsible for.
  */
  getTopics(): string[] {
    return ['tm_messagebox']
  }
}
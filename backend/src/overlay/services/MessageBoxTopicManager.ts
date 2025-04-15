import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { Transaction, ProtoWallet, Utils } from '@bsv/sdk'
import type { Advertisement } from '../types.js'
import docs from './MessageBoxTopicDocs.md.js'

export default class MessageBoxTopicManager implements TopicManager {
  private readonly anyoneWallet = new ProtoWallet('anyone')

  /**
   * Validate outputs for admission to the overlay network.
   * @param beef - The transaction in BEEF format.
   * @param previousCoins - The prior UTXOs associated with the transaction.
   * @returns AdmittanceInstructions with valid outputs.
   */
  async identifyAdmissibleOutputs (
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []

    try {
      const parsedTransaction = Transaction.fromBEEF(beef)

      for (const [i, output] of parsedTransaction.outputs.entries()) {
        try {
          const asmString = output.lockingScript.toASM()
          const jsonString = asmString.split(' ').pop() ?? ''
          const ad = JSON.parse(jsonString) as Advertisement

          if (
            ad.identityKey == null || ad.identityKey === '' ||
            ad.host == null || ad.host === '' ||
            ad.signature == null || ad.signature === ''
          ) {
            continue
          }

          const verifyResult = await this.anyoneWallet.verifySignature({
            protocolID: [0, 'messagebox-ad'],
            keyID: '1',
            counterparty: ad.identityKey,
            data: [
              ...Utils.toArray(ad.host, 'utf8'),
              ...Utils.toArray(ad.timestamp, 'utf8'),
              ...Utils.toArray(ad.nonce, 'utf8')
            ],
            signature: Utils.toArray(ad.signature, 'hex')
          })

          if (!verifyResult.valid) {
            continue
          }

          outputsToAdmit.push(i)
        } catch (error) {
          continue
        }
      }

      if (outputsToAdmit.length === 0) {
        console.warn('[OVERLAY] No outputs admitted.')
      }
    } catch (err) {
      const beefStr = JSON.stringify(beef, null, 2)
      throw new Error(`MessageBoxTopicManager error: ${err instanceof Error ? err.message : String(err)} beef: ${beefStr}`)
    }

    return {
      outputsToAdmit,
      coinsToRetain: previousCoins
    }
  }

  /**
   * Returns overlay topic documentation.
   */
  async getDocumentation (): Promise<string> {
    return docs
  }

  /**
   * Returns metadata about this topic.
   */
  async getMetaData (): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'MessageBox Topic Manager',
      shortDescription: 'Overlay advertisements for peer-to-peer message routing.'
    }
  }
}

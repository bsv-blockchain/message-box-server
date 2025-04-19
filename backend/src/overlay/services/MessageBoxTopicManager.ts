import { PushDrop, ProtoWallet, Utils, Transaction } from '@bsv/sdk'
import type { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import docs from './MessageBoxTopicDocs.md.js'

const anyoneWallet = new ProtoWallet('anyone')

export default class MessageBoxTopicManager implements TopicManager {
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

  async getDocumentation(): Promise<string> {
    return docs
  }

  async getMetaData() {
    return {
      name: 'MessageBox Topic Manager',
      shortDescription: 'Advertises and validates hosts for message routing.'
    }
  }

  getTopics(): string[] {
    return ['tm_messagebox']
  }
}

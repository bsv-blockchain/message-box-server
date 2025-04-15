import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { Transaction, ProtoWallet, Utils, TopicBroadcaster, Script } from '@bsv/sdk'
import type { Advertisement } from '../types.js'
import docs from './MessageBoxTopicDocs.md.js'
import { Logger } from '../../utils/logger.js'

const anyoneWallet = new ProtoWallet('anyone')

/**
 * MessageBoxTopicManager is the overlay TopicManager for `tm_messagebox`.
 * It validates advertisements and exposes metadata and documentation.
 */
export default class MessageBoxTopicManager implements TopicManager {
  /**
   * Validate SHIP advertisements and determine admissible outputs.
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
          const asm = output.lockingScript.toASM()
          const jsonStr = asm.split(' ').pop() ?? ''
          const ad = JSON.parse(jsonStr) as Advertisement

          if (
            typeof ad.identityKey !== 'string' || ad.identityKey.trim() === '' ||
            typeof ad.host !== 'string' || ad.host.trim() === '' ||
            typeof ad.signature !== 'string' || ad.signature.trim() === ''
          ) {
            // Invalid advertisement
            continue
          }

          const verified = await anyoneWallet.verifySignature({
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

          if (!verified.valid) continue

          outputsToAdmit.push(i)
        } catch {
          continue
        }
      }
    } catch (err) {
      const beefStr = JSON.stringify(beef, null, 2)
      throw new Error(`identifyAdmissibleOutputs failed: ${err instanceof Error ? err.message : String(err)}\nBEEF: ${beefStr}`)
    }

    return {
      outputsToAdmit,
      coinsToRetain: previousCoins
    }
  }

  /**
   * Get overlay topic documentation
   */
  async getDocumentation (): Promise<string> {
    return docs
  }

  /**
   * Get overlay topic metadata
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

  /**
   * Broadcasts a SHIP advertisement to anoint this host for a given identity key
   */
  static async broadcast ({
    identityKey,
    host
  }: {
    identityKey: string
    host: string
  }): Promise<{ txid: string, advertisement: Advertisement }> {
    Logger.log('[MB SERVER] Starting broadcast with identityKey:', identityKey)
    Logger.log('[MB SERVER] Target host:', host)

    const wallet = new ProtoWallet('anyone')

    const timestamp = new Date().toISOString()
    const nonce = Math.random().toString(36).slice(2)
    Logger.log('[MB SERVER] Timestamp:', timestamp)
    Logger.log('[MB SERVER] Nonce:', nonce)

    const payload = [
      ...Utils.toArray(host, 'utf8'),
      ...Utils.toArray(timestamp, 'utf8'),
      ...Utils.toArray(nonce, 'utf8')
    ]
    Logger.log('[MB SERVER] Payload (UTF8 arrays):', payload)

    let signature: number[]
    try {
      const { signature: rawSignature } = await wallet.createSignature({
        protocolID: [0, 'MBSERVEAD'],
        keyID: '1',
        counterparty: identityKey,
        data: payload
      })

      signature = Array.from(rawSignature)
      Logger.log('[MB SERVER] Created signature:', Utils.toHex(signature))
    } catch (err) {
      Logger.error('[MB SERVER] Failed to sign payload:', err)
      throw new Error('Failed to sign overlay advertisement')
    }

    const advertisement: Advertisement = {
      identityKey,
      host,
      timestamp,
      nonce,
      signature: Utils.toHex(signature),
      protocol: 'MBSERVEAD',
      version: '1.0'
    }
    Logger.log('[MB SERVER] Advertisement object:', advertisement)

    const adHex = Buffer.from(JSON.stringify(advertisement)).toString('hex')
    const script = Script.fromASM(`0 OP_RETURN ${adHex}`)
    Logger.log('[MB SERVER] Created locking script:', script.toASM())

    const tx = new Transaction()
    tx.addOutput({
      satoshis: 1,
      lockingScript: script
    })
    Logger.log('[MB SERVER] Built transaction (hex):', tx.toHex())

    const broadcaster = new TopicBroadcaster(['tm_messagebox'], {
      networkPreset: 'local'
    })

    Logger.log('[MB SERVER] Broadcasting transaction to overlay...')
    const result = await broadcaster.broadcast(tx)
    Logger.log('[MB SERVER] Broadcast result:', result)

    if (result.status !== 'success') {
      throw new Error(`Overlay broadcast failed: ${result.description}`)
    }

    Logger.log('[MB SERVER] Broadcast successful! txid:', result.txid)
    return {
      txid: result.txid,
      advertisement
    }
  }
}

/* eslint-disable @typescript-eslint/no-extraneous-class */
import { broadcastAdvertisement } from '../../utils/advertiserIntegration.js'
import { getWallet, knex } from '../../app.js'
import { Logger } from '../../utils/logger.js'
import { MessageBoxStorage } from './MessageBoxStorage.js'
import type { Advertisement } from '../types.js'

const { ADVERTISEMENT_HOST, HTTP_PORT } = process.env

/**
 * MessageBoxTopicManager is responsible for managing overlay advertisements
 * for the Message Box system. It handles broadcasting new advertisements,
 * rebroadcasting existing ones, and listing recent advertisements.
 */
export class MessageBoxTopicManager {
  static async broadcast (
    opts?: { host?: string, identityKey?: string }
  ): Promise<{ advertisement: Advertisement, txid: string }> {
    const wallet = await getWallet()

    const identityKey = opts?.identityKey ??
        (await wallet.getPublicKey({ identityKey: true })).publicKey

    const host = opts?.host ?? ADVERTISEMENT_HOST ?? `http://localhost:${HTTP_PORT ?? '3000'}`

    Logger.log(`[ADVERTISER] Broadcasting advertisement for identityKey: ${identityKey} on host: ${host}`)

    const result = await broadcastAdvertisement({
      host,
      identityKey,
      wallet
    })

    const adRaw = result.advertisement
    const txid = result.txid

    if (adRaw == null) throw new Error('Missing advertisement payload in result.')
    if (txid == null || txid === '') throw new Error('Missing txid in result.')

    const ad: Advertisement = {
      protocol: 'MB_AD',
      version: '1.0',
      identityKey: adRaw.identityKey,
      host: adRaw.host,
      timestamp: adRaw.timestamp,
      nonce: adRaw.nonce,
      signature: adRaw.signature,
      txid
    }

    await new MessageBoxStorage(knex).storeAdvertisement({
      ...ad,
      timestamp: new Date(ad.timestamp)
    })

    Logger.log('[ADVERTISER] Advertisement stored in overlay_ads table.')

    return {
      advertisement: ad,
      txid
    }
  }

  /**
   * Rebroadcasts the current host's advertisement using default environment configuration.
   *
   * @returns The rebroadcasted advertisement and its transaction ID.
   */
  static async rebroadcast (): Promise<{ advertisement: Advertisement, txid: string }> {
    return await this.broadcast()
  }

  /**
   * Lists the most recent advertisements from the local database.
   *
   * @param limit - Maximum number of advertisements to return (default is 20).
   * @returns An array of recent Advertisement objects.
   */
  static async listRecentAds (limit = 20): Promise<Advertisement[]> {
    return await new MessageBoxStorage(knex).listRecentAds(limit)
  }
}

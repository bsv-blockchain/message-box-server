import { Router } from 'express'
import { broadcastAdvertisement } from '../utils/advertiserIntegration.js'
import { Logger } from '../utils/logger.js'
import { wallet, HTTP_PORT, knex } from '../index.js'

const { SERVER_PRIVATE_KEY, ADVERTISEMENT_HOST } = process.env

const router = Router()

// POST /overlay/advertise
router.post('/advertise', async (req, res) => {
  try {
    const result = await broadcastAdvertisement({
      host: ADVERTISEMENT_HOST ?? `http://localhost:${HTTP_PORT}`,
      identityKey: await wallet.getPublicKey({ identityKey: true }).then(r => r.publicKey),
      privateKey: SERVER_PRIVATE_KEY ?? '',
      wallet
    })

    const ad = result.advertisement ?? {}
    await knex('overlay_ads').insert({
      identity_key: ad.identityKey,
      host: ad.host,
      timestamp: ad.timestamp,
      nonce: ad.nonce,
      signature: ad.signature,
      txid: result.txid,
      created_at: new Date()
    })

    Logger.log('[ADVERTISER] Stored overlay advertisement in DB')
    res.status(200).json(result)
  } catch (error) {
    Logger.error('[ADVERTISER ERROR] Manual overlay advertisement failed:', error)
    res.status(500).json({ error: 'Failed to broadcast advertisement.' })
  }
})

// POST /overlay/rebroadcast
router.post('/rebroadcast', async (req, res) => {
  try {
    const result = await broadcastAdvertisement({
      host: ADVERTISEMENT_HOST ?? `http://localhost:${HTTP_PORT}`,
      identityKey: await wallet.getPublicKey({ identityKey: true }).then(r => r.publicKey),
      privateKey: SERVER_PRIVATE_KEY ?? '',
      wallet
    })

    const ad = result.advertisement ?? {}
    await knex('overlay_ads').insert({
      identity_key: ad.identityKey,
      host: ad.host,
      timestamp: ad.timestamp,
      nonce: ad.nonce,
      signature: ad.signature,
      txid: result.txid,
      created_at: new Date()
    })

    Logger.log('[ADVERTISER] Stored rebroadcasted advertisement in DB')
    res.status(200).json(result)
  } catch (error) {
    Logger.error('[ADVERTISER ERROR] Manual rebroadcast failed:', error)
    res.status(500).json({ error: 'Failed to rebroadcast advertisement.' })
  }
})

// GET /overlay/ads
router.get('/ads', async (req, res) => {
  try {
    const ads = await knex('overlay_ads')
      .orderBy('created_at', 'desc')
      .limit(20)

    res.status(200).json({ ads })
  } catch (error) {
    Logger.error('[ADVERTISER ERROR] Failed to list advertisements:', error)
    res.status(500).json({ error: 'Failed to list advertisements.' })
  }
})

export default router

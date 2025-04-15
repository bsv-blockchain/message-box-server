import { Router, Response, Request, RequestHandler } from 'express'
import { Logger } from '../utils/logger.js'
import { MessageBoxTopicManager } from '../overlay/services/MessageBoxTopicManager.js'
import type { AuthenticatedRequest } from '../overlay/types.js'

const router = Router()

// POST /overlay/advertise — Manually advertise this host
router.post('/advertise', async (_req, res: Response) => {
  try {
    const result = await MessageBoxTopicManager.broadcast()
    Logger.log('[ADVERTISER] Broadcasted advertisement and stored in DB')
    res.status(200).json(result)
  } catch (error) {
    Logger.error('[ADVERTISER ERROR] Manual advertisement failed:', error)
    res.status(500).json({ error: 'Failed to broadcast advertisement.' })
  }
})

// POST /overlay/rebroadcast — Trigger a rebroadcast
router.post('/rebroadcast', async (_req, res: Response) => {
  try {
    const result = await MessageBoxTopicManager.rebroadcast()
    Logger.log('[ADVERTISER] Rebroadcasted advertisement and stored in DB')
    res.status(200).json(result)
  } catch (error) {
    Logger.error('[ADVERTISER ERROR] Manual rebroadcast failed:', error)
    res.status(500).json({ error: 'Failed to rebroadcast advertisement.' })
  }
})

// GET /overlay/ads — Get recent advertisements
router.get('/ads', async (_req, res: Response) => {
  try {
    const ads = await MessageBoxTopicManager.listRecentAds()
    res.status(200).json({ ads })
  } catch (error) {
    Logger.error('[ADVERTISER ERROR] Failed to list advertisements:', error)
    res.status(500).json({ error: 'Failed to list advertisements.' })
  }
})

// POST /overlay/anoint — User explicitly anoints a host to represent them
router.post(
  '/anoint',
  (async function handler (
    req: Request,
    res: Response
  ) {
    const typedReq = req as AuthenticatedRequest
    const { host } = typedReq.body
    const identityKey = typedReq.auth?.identityKey

    if (typeof host !== 'string' || !host.startsWith('http')) {
      return res.status(400).json({ error: 'Invalid host' })
    }

    if (typeof identityKey !== 'string' || identityKey === '') {
      return res.status(401).json({ error: 'Missing identity key' })
    }

    const result = await MessageBoxTopicManager.broadcast({ host, identityKey })

    res.status(200).json({
      status: 'success',
      advertisement: result.advertisement,
      txid: result.txid
    })
  }) as RequestHandler
)

export default router

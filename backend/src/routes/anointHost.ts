import { Request, Response } from 'express'
import { Logger } from '../utils/logger.js'
import MessageBoxTopicManager from '../overlay/services/MessageBoxTopicManager.js'
import type { AuthenticatedRequest } from '../overlay/types.js'

/**
 * POST /overlay/anoint
 * Authenticated route for anointing a host to represent the user's identityKey in the overlay.
 */
export default {
  type: 'post',
  path: '/overlay/anoint',
  summary: 'Anoint a host to represent your identity key in the overlay network',
  parameters: {
    host: 'http://localhost:5001'
  },
  exampleResponse: {
    status: 'success',
    advertisement: {
      identityKey: 'your-key',
      host: 'http://localhost:5001',
      txid: '...'
    }
  },
  func: async (req: Request, res: Response): Promise<Response> => {
    const { host } = req.body
    const identityKey = (req as AuthenticatedRequest).auth?.identityKey

    if (typeof host !== 'string' || !host.startsWith('http')) {
      return res.status(400).json({ error: 'Invalid host' })
    }

    if (typeof identityKey !== 'string' || identityKey.trim() === '') {
      return res.status(401).json({ error: 'Missing or invalid identity key' })
    }

    try {
      const result = await MessageBoxTopicManager.broadcast({ host, identityKey })

      return res.status(200).json({
        status: 'success',
        advertisement: result.advertisement,
        txid: result.txid
      })
    } catch (err) {
      Logger.error('[anointHost] Failed to broadcast overlay ad:', err)
      return res.status(500).json({ error: 'Failed to broadcast overlay advertisement' })
    }
  }
}

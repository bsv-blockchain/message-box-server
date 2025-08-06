import { Response } from 'express'
import { PublicKey } from '@bsv/sdk'
import { Logger } from '../../utils/logger.js'
import { AuthRequest } from '@bsv/auth-express-middleware'
import { getRecipientFee, getServerDeliveryFee } from '../../utils/messagePermissions.js'

export interface GetQuoteRequest extends AuthRequest {
  query: {
    recipient?: string // identityKey of recipient
    messageBox?: string // messageBox type
  }
}

/**
 * @swagger
 * /permissions/quote:
 *   get:
 *     summary: Get message delivery quote
 *     description: Get pricing information for sending messages to a specific recipient's message box
 *     tags:
 *       - Permissions
 *     parameters:
 *       - in: query
 *         name: recipient
 *         required: true
 *         schema:
 *           type: string
 *         description: identityKey of the recipient
 *       - in: query
 *         name: messageBox
 *         required: true
 *         schema:
 *           type: string
 *         description: messageBox type
 *     responses:
 *       200:
 *         description: Quote retrieved successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
export default {
  type: 'get',
  path: '/permissions/quote',
  func: async (req: GetQuoteRequest, res: Response): Promise<Response> => {
    try {
      Logger.log('[DEBUG] Processing message quote request')

      // Validate authentication
      if (req.auth?.identityKey == null) {
        Logger.log('[DEBUG] Authentication required for message quote')
        return res.status(401).json({
          status: 'error',
          code: 'ERR_AUTHENTICATION_REQUIRED',
          description: 'Authentication required.'
        })
      }

      const { recipient, messageBox } = req.query

      // Validate required parameters
      if (recipient == null || messageBox == null) {
        Logger.log('[DEBUG] Missing required parameters for message quote')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MISSING_PARAMETERS',
          description: 'recipient and messageBox parameters are required.'
        })
      }

      // Validate recipient public key format
      try {
        PublicKey.fromString(recipient)
      } catch (error) {
        Logger.log('[DEBUG] Invalid recipient public key format')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_PUBLIC_KEY',
          description: 'Invalid recipient public key format.'
        })
      }

      // Calculate fees for this sender/recipient/box combination
      const deliveryFee = await getServerDeliveryFee(messageBox)
      const recipientFee = await getRecipientFee(recipient, req.auth.identityKey, messageBox)

      return res.status(200).json({
        status: 'success',
        description: 'Message delivery quote generated.',
        quote: {
          deliveryFee,
          recipientFee
        }
      })
    } catch (error) {
      Logger.error('[ERROR] Internal Server Error in message quote:', error)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}

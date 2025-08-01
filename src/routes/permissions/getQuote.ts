import { Response } from 'express'
import { PublicKey } from '@bsv/sdk'
import { Logger } from '../../utils/logger.js'
import { AuthRequest } from '@bsv/auth-express-middleware'
import { calculateMessageFees } from '../../utils/messagePermissions.js'
import { MessageQuoteResponse } from '../../types/messagePermissions.js'

export interface GetQuoteRequest extends AuthRequest {
  query: {
    recipient?: string // identityKey of recipient
    message_box?: string // messageBox type
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
 *         name: message_box
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

      const { recipient, message_box } = req.query

      // Validate required parameters
      if (recipient == null || message_box == null) {
        Logger.log('[DEBUG] Missing required parameters for message quote')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MISSING_PARAMETERS',
          description: 'recipient and message_box parameters are required.'
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

      const senderKey = req.auth.identityKey

      // Calculate fees for this sender/recipient/box combination
      const feeResult = await calculateMessageFees(recipient, senderKey, message_box, 0)

      Logger.log(`[DEBUG] Fee calculation for ${senderKey} -> ${recipient} (${message_box}): ${JSON.stringify(feeResult)}`)

      let permissionStatus: 'allowed' | 'blocked' | 'payment_required' | 'no_permission'
      let description: string

      if (!feeResult.allowed && feeResult.blocked_reason != null) {
        if (feeResult.recipient_fee === 0) {
          permissionStatus = 'blocked'
          description = `Messages to ${recipient}'s ${message_box} are blocked.`
        } else {
          permissionStatus = 'payment_required'
          description = `Messages to ${recipient}'s ${message_box} require payment of ${feeResult.total_cost} satoshis.`
        }
      } else if (feeResult.requires_payment) {
        permissionStatus = 'payment_required'
        description = `Messages to ${recipient}'s ${message_box} require payment of ${feeResult.total_cost} satoshis.`
      } else {
        permissionStatus = 'allowed'
        description = `Messages to ${recipient}'s ${message_box} are allowed (${feeResult.total_cost === 0 ? 'free' : feeResult.total_cost + ' satoshis'}).`
      }

      const quote: MessageQuoteResponse = {
        sender: senderKey,
        recipient,
        message_box,
        delivery_allowed: feeResult.allowed,
        delivery_fee: feeResult.delivery_fee,
        recipient_fee: feeResult.recipient_fee,
        total_cost: feeResult.total_cost,
        permission_status: permissionStatus,
        description,
        currency: 'satoshis',
        valid_until: new Date(Date.now() + 300000).toISOString() // Valid for 5 minutes
      }

      return res.status(200).json({
        status: 'success',
        description: 'Message delivery quote generated.',
        quote
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

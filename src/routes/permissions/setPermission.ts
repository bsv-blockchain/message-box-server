import { Response } from 'express'
import { PublicKey } from '@bsv/sdk'
import { Logger } from '../../utils/logger.js'
import { AuthRequest } from '@bsv/auth-express-middleware'
import { SetMessagePermissionRequest } from '../../types/messagePermissions.js'
import { setMessagePermission } from '../../utils/messagePermissions.js'

export interface SetPermissionRequestType extends AuthRequest {
  body: SetMessagePermissionRequest
}

/**
 * @swagger
 * /permissions/set:
 *   post:
 *     summary: Set message permission for a sender/box combination
 *     description: Set permission level for receiving messages from a specific sender to a specific message box
 *     tags:
 *       - Permissions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sender
 *               - message_box
 *               - recipient_fee
 *             properties:
 *               sender:
 *                 type: string
 *                 description: identityKey of the sender
 *               message_box:
 *                 type: string
 *                 description: messageBox type (e.g., 'notifications', 'inbox')
 *               recipient_fee:
 *                 type: integer
 *                 description: Fee level (-1=always allow, 0=blocked, >0=satoshi amount required)
 *     responses:
 *       200:
 *         description: Permission successfully updated
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
export default {
  type: 'post',
  path: '/permissions/set',
  func: async (req: SetPermissionRequestType, res: Response): Promise<Response> => {
    try {
      Logger.log('[DEBUG] Processing set message permission request')

      // Validate authentication
      if (req.auth?.identityKey == null) {
        Logger.log('[DEBUG] Authentication required for set permission')
        return res.status(401).json({
          status: 'error',
          code: 'ERR_AUTHENTICATION_REQUIRED',
          description: 'Authentication required.'
        })
      }

      const { sender, message_box, recipient_fee } = req.body

      // Validate request body
      if (sender == null || message_box == null || typeof recipient_fee !== 'number') {
        Logger.log('[DEBUG] Invalid request body for set permission')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_REQUEST',
          description: 'sender (identityKey), message_box (string), and recipient_fee (number) are required.'
        })
      }

      // Validate sender public key format
      try {
        PublicKey.fromString(sender)
      } catch (error) {
        Logger.log('[DEBUG] Invalid sender public key format')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_PUBLIC_KEY',
          description: 'Invalid sender public key format.'
        })
      }

      // Validate recipient_fee value
      if (!Number.isInteger(recipient_fee)) {
        Logger.log('[DEBUG] Invalid recipient_fee value - must be integer')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_FEE_VALUE',
          description: 'recipient_fee must be an integer (-1, 0, or positive number).'
        })
      }

      // Validate message_box value
      if (typeof message_box !== 'string' || message_box.trim() === '') {
        Logger.log('[DEBUG] Invalid message_box value')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGE_BOX',
          description: 'message_box must be a non-empty string.'
        })
      }

      const recipient = req.auth.identityKey

      // Set the message permission
      const success = await setMessagePermission(recipient, sender, message_box, recipient_fee)

      if (success == null) {
        return res.status(500).json({
          status: 'error',
          code: 'ERR_DATABASE_ERROR',
          description: 'Failed to update message permission.'
        })
      }

      Logger.log(`[DEBUG] Successfully updated message permission: ${sender} -> ${recipient} (${message_box}), fee: ${recipient_fee}`)

      let description: string
      if (recipient_fee === -1) {
        description = `Messages from ${sender} to ${message_box} are now always allowed.`
      } else if (recipient_fee === 0) {
        description = `Messages from ${sender} to ${message_box} are now blocked.`
      } else {
        description = `Messages from ${sender} to ${message_box} now require ${recipient_fee} satoshis.`
      }

      return res.status(200).json({
        status: 'success',
        description,
        permission: {
          sender,
          message_box,
          recipient_fee,
          updated_at: new Date().toISOString()
        }
      })
    } catch (error) {
      Logger.error('[ERROR] Internal Server Error in set permission:', error)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}

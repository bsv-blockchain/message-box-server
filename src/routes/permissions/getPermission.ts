import { Response } from 'express'
import { PublicKey } from '@bsv/sdk'
import { Logger } from '../../utils/logger.js'
import { AuthRequest } from '@bsv/auth-express-middleware'
import { getMessagePermission } from '../../utils/messagePermissions.js'

export interface GetPermissionRequest extends AuthRequest {
  query: {
    sender?: string // identityKey of sender to check
    message_box?: string // messageBox type to check
  }
}

/**
 * @swagger
 * /permissions/get:
 *   get:
 *     summary: Get message permission for a sender/box combination
 *     description: Retrieve the permission setting for a specific sender and message box combination
 *     tags:
 *       - Permissions
 *     parameters:
 *       - in: query
 *         name: sender
 *         required: true
 *         schema:
 *           type: string
 *         description: identityKey of the sender to check
 *       - in: query
 *         name: message_box
 *         required: true
 *         schema:
 *           type: string
 *         description: messageBox type to check
 *     responses:
 *       200:
 *         description: Permission setting retrieved successfully (or undefined if not set)
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
export default {
  type: 'get',
  path: '/permissions/get',
  func: async (req: GetPermissionRequest, res: Response): Promise<Response> => {
    try {
      Logger.log('[DEBUG] Processing get message permission request')

      // Validate authentication
      if (req.auth?.identityKey == null) {
        Logger.log('[DEBUG] Authentication required for get permission')
        return res.status(401).json({
          status: 'error',
          code: 'ERR_AUTHENTICATION_REQUIRED',
          description: 'Authentication required.'
        })
      }

      const { sender, message_box } = req.query

      // Validate required parameters
      if (sender == null || message_box == null) {
        Logger.log('[DEBUG] Missing required parameters for get permission')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MISSING_PARAMETERS',
          description: 'sender and message_box parameters are required.'
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

      const recipient = req.auth.identityKey

      // Get message permission
      const permission = await getMessagePermission(recipient, sender, message_box)

      Logger.log(`[DEBUG] Permission record for ${sender} -> ${recipient} (${message_box}): ${JSON.stringify(permission)}`)

      if (permission != null) {
        // Permission is set, return it
        return res.status(200).json({
          status: 'success',
          description: `Permission setting found for sender ${sender} to ${message_box}.`,
          permission: {
            sender,
            message_box,
            recipient_fee: permission.recipient_fee,
            created_at: permission.created_at.toISOString(),
            updated_at: permission.updated_at.toISOString()
          }
        })
      } else {
        // No permission set, return undefined
        return res.status(200).json({
          status: 'success',
          description: `No permission setting found for sender ${sender} to ${message_box}.`,
          permission: undefined
        })
      }
    } catch (error) {
      Logger.error('[ERROR] Internal Server Error in get permission:', error)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}

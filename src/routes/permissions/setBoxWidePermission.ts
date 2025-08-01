import { Response } from 'express'
import { Logger } from '../../utils/logger.js'
import { AuthRequest } from '@bsv/auth-express-middleware'
import { setMessagePermission } from '../../utils/messagePermissions.js'

export interface SetBoxWidePermissionRequest extends AuthRequest {
  body: {
    message_box: string
    recipient_fee: number // -1 = always allow, 0 = block all, >0 = satoshi fee
  }
}

/**
 * @swagger
 * /permissions/set-box-wide:
 *   post:
 *     summary: Set box-wide default permission
 *     description: Set default permission for all senders to a specific message box
 *     tags:
 *       - Permissions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message_box
 *               - recipient_fee
 *             properties:
 *               message_box:
 *                 type: string
 *                 description: messageBox type (e.g., 'notifications', 'inbox')
 *               recipient_fee:
 *                 type: integer
 *                 description: Fee in satoshis (-1 for free, 0 for blocked, >0 for fee)
 *     responses:
 *       200:
 *         description: Box-wide permission set successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
export default {
  type: 'post',
  path: '/permissions/set-box-wide',
  func: async (req: SetBoxWidePermissionRequest, res: Response): Promise<Response> => {
    try {
      Logger.log('[DEBUG] Processing set box-wide permission request')

      // Validate authentication
      if (req.auth?.identityKey == null) {
        Logger.log('[DEBUG] Authentication required for set box-wide permission')
        return res.status(401).json({
          status: 'error',
          code: 'ERR_AUTHENTICATION_REQUIRED',
          description: 'Authentication required.'
        })
      }

      const { message_box, recipient_fee } = req.body

      // Validate request body
      if (message_box == null || typeof recipient_fee !== 'number') {
        Logger.log('[DEBUG] Invalid request body for set box-wide permission')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_REQUEST',
          description: 'message_box (string) and recipient_fee (number) are required.'
        })
      }

      // Validate recipient_fee value
      if (!Number.isInteger(recipient_fee)) {
        Logger.log('[DEBUG] Invalid recipient_fee value - must be integer')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_RECIPIENT_FEE',
          description: 'recipient_fee must be an integer (-1, 0, or positive number).'
        })
      }

      const recipient = req.auth.identityKey

      // Set box-wide permission (sender = null)
      try {
        await setMessagePermission(recipient, null, message_box, recipient_fee)

        Logger.log(`[DEBUG] Successfully set box-wide permission: ${recipient} (${message_box}), fee: ${recipient_fee}`)

        return res.status(200).json({
          status: 'success',
          description: `Box-wide permission for ${message_box} set successfully.`,
          permission: {
            recipient,
            sender: null, // Box-wide
            message_box,
            recipient_fee,
            updated_at: new Date().toISOString()
          }
        })
      } catch (error) {
        Logger.error('[ERROR] Database error setting box-wide permission:', error)
        return res.status(500).json({
          status: 'error',
          code: 'ERR_DATABASE_ERROR',
          description: 'Failed to set box-wide permission.'
        })
      }
    } catch (error) {
      Logger.error('[ERROR] Internal Server Error in set box-wide permission:', error)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL_SERVER_ERROR',
        description: 'Internal server error.'
      })
    }
  }
}

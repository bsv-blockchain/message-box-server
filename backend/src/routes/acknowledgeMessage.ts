import { Request, Response } from 'express'
import knexConfig from '../knexfile.js'
import * as knexLib from 'knex'
import { Logger } from '../utils/logger.js'
import createMessageBoxLookupService from '../overlay/services/MessageBoxLookupServiceFactory.js'

const { NODE_ENV = 'development' } = process.env

const knex: knexLib.Knex = (knexLib as any).default?.(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
) ?? (knexLib as any)(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
)

/**
 * Extended Express Request interface for /acknowledgeMessage route.
 *
 * Includes:
 * - `auth.identityKey`: The authenticated identity key of the requester (injected via middleware).
 * - `body.messageIds`: An optional array of message IDs to be acknowledged.
 *
 * Used to ensure type safety and clarity when handling the /acknowledgeMessage POST request.
 */
export interface AcknowledgeRequest extends Request {
  auth: { identityKey: string }
  body: { messageIds?: string[] }
}

/**
 * Express route handler for acknowledging messages.
 *
 * This route allows a recipient to acknowledge one or more messages by their IDs.
 *
 * If the messages exist in the local database, they are deleted and the route returns success.
 * If the messages are not found locally, the system attempts to forward the acknowledgment
 * to a remote overlay host that the recipient has anointed.
 *
 * Supports both local and overlay-based acknowledgment behavior.
 *
 * Route: POST /acknowledgeMessage
 * Auth: Required via `Authorization` header
 */
export default {
  type: 'post',
  path: '/acknowledgeMessage',
  knex,
  summary: 'Use this route to acknowledge a message has been received',
  parameters: {
    messageIds: ['3301']
  },
  exampleResponse: {
    status: 'success'
  },
  errors: [],
  func: async (req: AcknowledgeRequest, res: Response): Promise<Response> => {
    try {
      const { messageIds } = req.body
      const identityKey = req.auth.identityKey

      Logger.log('[SERVER] acknowledgeMessage called for messageIds:', messageIds, 'by', identityKey)

      // Validate request body
      if ((messageIds == null) || (Array.isArray(messageIds) && messageIds.length === 0)) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGE_ID_REQUIRED',
          description: 'Please provide the ID of the message(s) to acknowledge!'
        })
      }

      if (!Array.isArray(messageIds) || messageIds.some(id => typeof id !== 'string')) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGE_ID',
          description: 'Message IDs must be formatted as an array of strings!'
        })
      }

      // Attempt local delete
      const deleted = await knex('messages')
        .where({ recipient: identityKey })
        .whereIn('messageId', messageIds)
        .del()

      if (deleted > 0) {
        return res.status(200).json({ status: 'success', source: 'local' })
      }

      // If not found locally, try overlay
      const overlayService = createMessageBoxLookupService()
      const result = await overlayService.acknowledgeMessages(identityKey, messageIds)

      if (result?.acknowledged === true) {
        return res.status(200).json({ status: 'success', source: 'overlay' })
      }

      return res.status(400).json({
        status: 'error',
        code: 'ERR_INVALID_ACKNOWLEDGMENT',
        description: 'Message not found locally or remotely!'
      })
    } catch (e) {
      Logger.error('[acknowledgeMessage ERROR]', e)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL_ERROR',
        description: 'An internal error has occurred while acknowledging the message'
      })
    }
  }
}

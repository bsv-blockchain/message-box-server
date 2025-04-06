import { Request, Response } from 'express'
import knexConfig from '../../knexfile.js'
import * as knexLib from 'knex'
import { Logger } from '../utils/logger.js'
import { MessageBoxLookupService } from '../overlay/services/MessageBoxLookupService.js'
import { MessageBoxStorage } from '../overlay/services/MessageBoxStorage.js'

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

export interface AcknowledgeRequest extends Request {
  auth: { identityKey: string }
  body: { messageIds?: string[] }
}

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
      Logger.log('[OVERLAY] No local messages acknowledged. Trying overlay...')
      const overlayService = new MessageBoxLookupService(new MessageBoxStorage(knex))

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

import { Request, Response } from 'express'
import knexConfig from '../../knexfile.js'
import * as knexLib from 'knex'

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

      // The server removes the message after it has been acknowledged
      const deleted = await knex('messages')
        .where({ recipient: req.auth.identityKey })
        .whereIn('messageId', Array.isArray(messageIds) ? messageIds : [messageIds])
        .del()

      if (deleted === 0) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_ACKNOWLEDGMENT',
          description: 'Message not found!'
        })
      }

      if (deleted < 0) {
        throw new Error('Deletion failed')
      }

      return res.status(200).json({ status: 'success' })
    } catch (e) {
      console.error(e)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL_ERROR',
        description: 'An internal error has occurred while acknowledging the message'
      })
    }
  }
}

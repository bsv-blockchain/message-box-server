import { Request, Response } from 'express'
import knexConfig from '../knexfile.js'
import * as knexLib from 'knex'
import createMessageBoxLookupService from '../overlay/services/MessageBoxLookupServiceFactory.js'
import { Logger } from '../utils/logger.js'

const { NODE_ENV = 'development' } = process.env

// Initialize Knex based on environment
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
 * Extended Express Request interface for the /listMessages route.
 *
 * Includes:
 * - `auth.identityKey`: Identity key extracted from the Authorization header.
 * - `body.messageBox`: The name of the messageBox to list messages from.
 */
interface ListMessagesRequest extends Request {
  auth: { identityKey: string }
  body: { messageBox?: string }
}

// Exported route definition for listing messages from a messageBox.
export default {
  type: 'post',
  path: '/listMessages',
  knex,
  summary: 'Use this route to list messages from your messageBox.',
  parameters: {
    messageBox: 'The name of the messageBox you would like to list messages from.'
  },
  exampleResponse: {
    status: 'success',
    messages: [
      {
        messageId: '3301',
        body: '{}',
        sender: '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1'
      }
    ]
  },

  /**
   * Main handler function for the /listMessages route.
   *
   * Checks the local messageBox table for messages for the authenticated identityKey.
   * Falls back to an overlay service if no local messageBox exists.
   */
  func: async (req: ListMessagesRequest, res: Response): Promise<Response> => {
    try {
      const { messageBox } = req.body
      const identityKey = req.auth.identityKey

      if (typeof messageBox !== 'string' || messageBox.trim() === '') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGEBOX',
          description: 'MessageBox name must be a string!'
        })
      }

      // Check for a local messageBox
      const [messageBoxRecord] = await knex('messageBox')
        .where({
          identityKey,
          type: messageBox
        })
        .select('messageBoxId')

      if (messageBoxRecord !== undefined) {
        // Local messageBox found — return messages
        const messages = await knex('messages')
          .where({
            recipient: identityKey,
            messageBoxId: messageBoxRecord.messageBoxId
          })
          .select('messageId', 'body', 'sender', 'created_at', 'updated_at')

        return res.status(200).json({
          status: 'success',
          source: 'local',
          messages
        })
      }

      // No local messageBox — check the overlay
      Logger.log(`[OVERLAY] No local messageBox found for ${identityKey}. Checking overlay...`)

      const overlayService = createMessageBoxLookupService()

      const remoteMessages = await overlayService.listMessages(identityKey, messageBox)

      if (remoteMessages != null) {
        Logger.log(`[OVERLAY] Retrieved ${remoteMessages.length} remote messages.`)
        return res.status(200).json({
          status: 'success',
          source: 'overlay',
          messages: remoteMessages
        })
      }

      Logger.warn(`[OVERLAY] No remote messageBox found or host unreachable for ${identityKey}.`)
      return res.status(200).json({
        status: 'success',
        source: 'none',
        messages: []
      })
    } catch (e) {
      Logger.error('[listMessages ERROR]', e)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL_ERROR',
        description: 'An internal error has occurred while listing messages.'
      })
    }
  }
}

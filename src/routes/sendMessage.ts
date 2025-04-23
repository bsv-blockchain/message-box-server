/**
 * @file sendMessage.ts
 * @description Route handler to send a message to a specific messageBox belonging to another user.
 * This endpoint allows one identity to send a message to another, optionally enforcing payment and ID validation.
 */

import { Request, Response } from 'express'
import knexConfig from '../../knexfile.js'
import * as knexLib from 'knex'
import { PublicKey } from '@bsv/sdk'
import { webcrypto } from 'crypto'
import { Logger } from '../utils/logger.js'

(global as any).self = { crypto: webcrypto }

// Determine the environment (default to development)
const { NODE_ENV = 'development', SERVER_PRIVATE_KEY } = process.env

// Load the appropriate Knex configuration based on the environment
const knex: knexLib.Knex = (knexLib as any).default?.(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
) ?? (knexLib as any)(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
)

// Type definition for the incoming message format
interface Message {
  recipient: string
  messageBox: string
  messageId: string
  body: string
}

// Expected request body structure
interface SendMessageRequestBody {
  message?: Message
  priority?: boolean
  payment?: { satoshisPaid: number }
}

// Extended Express request type with authentication
interface SendMessageRequest extends Request {
  auth: { identityKey: string }
  body: SendMessageRequestBody
}

// Validate critical server-side secret
if (SERVER_PRIVATE_KEY == null || SERVER_PRIVATE_KEY.trim() === '') {
  throw new Error('SERVER_PRIVATE_KEY is not defined in the environment variables.')
}

/**
 * @function calculateMessagePrice
 * @description Determines the price (in satoshis) to send a message, optionally with priority.
 */
export function calculateMessagePrice (message: string, priority: boolean = false): number {
  const basePrice = 2 // Base fee in satoshis
  const sizeFactor = Math.ceil(Buffer.byteLength(message, 'utf8') / 1024) * 3 // Satoshis per KB

  return basePrice + sizeFactor
}

// Export the route
export default {
  type: 'post',
  path: '/sendMessage',
  knex,
  summary: "Use this route to send a message to a recipient's message box.",
  parameters: {
    message: {
      recipient: '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1',
      messageBox: 'payment_inbox',
      messageId: 'xyz123',
      body: '{}'
    }
  },
  exampleResponse: { status: 'success' },

  /**
   * @function func
   * @description Main request handler for sending a message to another identity's message box.
   */
  func: async (req: SendMessageRequest, res: Response): Promise<Response> => {
    Logger.log('[DEBUG] Processing /sendMessage request...')
    Logger.log('[DEBUG] Request Headers:', JSON.stringify(req.headers, null, 2))
    Logger.log('[DEBUG] Request Body:', JSON.stringify(req.body, null, 2))

    try {
      const { message } = req.body
      // Validate presence and structure of the message
      if (message == null) {
        Logger.error('[ERROR] No message provided in request body!')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGE_REQUIRED',
          description: 'Please provide a valid message to send!'
        })
      }

      // Validate message structure
      if (message == null || typeof message !== 'object') {
        return res.status(400).json({ status: 'error', code: 'ERR_INVALID_MESSAGE', description: 'Invalid message structure.' })
      }
      if (typeof message.recipient !== 'string' || message.recipient.trim() === '') {
        return res.status(400).json({ status: 'error', code: 'ERR_INVALID_RECIPIENT', description: 'Invalid recipient.' })
      }
      if (typeof message.messageBox !== 'string' || message.messageBox.trim() === '') {
        return res.status(400).json({ status: 'error', code: 'ERR_INVALID_MESSAGEBOX', description: 'Invalid message box.' })
      }
      if (typeof message.messageId !== 'string' || message.messageId.trim() === '') {
        return res.status(400).json({ status: 'error', code: 'ERR_INVALID_MESSAGEID', description: 'Invalid message ID.' })
      }
      if (
        (typeof message.body !== 'string' &&
         (typeof message.body !== 'object' || message.body === null)) ||
        (typeof message.body === 'string' && message.body.trim() === '')
      ) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGE_BODY',
          description: 'Invalid message body.'
        })
      }

      // Confirm the recipient key is a valid public key
      Logger.log('[DEBUG] Validating recipient key:', message.recipient)
      try {
        PublicKey.fromString(message.recipient)
        Logger.log('[DEBUG] Parsed Recipient Public Key Successfully:', message.recipient)
      } catch (error) {
        return res.status(400).json({ status: 'error', code: 'ERR_INVALID_RECIPIENT_KEY', description: 'Invalid recipient key format.' })
      }

      Logger.log(`[DEBUG] Storing message for recipient: ${message.recipient}`)

      // Retrieve or create the messageBox for the recipient
      let messageBox = await knex('messageBox')
        .where({ identityKey: message.recipient, type: message.messageBox })
        .first()

      if (messageBox == null) {
        Logger.log('[DEBUG] MessageBox not found, creating a new one...')
        await knex('messageBox').insert({
          identityKey: message.recipient,
          type: message.messageBox,
          created_at: new Date(),
          updated_at: new Date()
        })
      }

      // Re-fetch to get messageBoxId
      messageBox = await knex('messageBox')
        .where({ identityKey: message.recipient, type: message.messageBox })
        .select('messageBoxId')
        .first()

      // Insert the message into the DB
      Logger.log('[DEBUG] Inserting message into messages table...')
      try {
        const messageBoxId = messageBox?.messageBoxId ?? null

        // Normalize the message body into a string
        const normalizedBody =
        typeof message.body === 'string'
          ? message.body
          : JSON.stringify(message.body)

        await knex('messages')
          .insert({
            messageId: message.messageId,
            messageBoxId,
            sender: req.auth?.identityKey ?? null,
            recipient: message.recipient,
            body: normalizedBody,
            created_at: new Date(),
            updated_at: new Date()
          })
          .onConflict('messageId')
          .ignore()
      } catch (error) {
        if ((error as any).code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ status: 'error', code: 'ERR_DUPLICATE_MESSAGE', description: 'Duplicate message.' })
        }
        throw error
      }

      Logger.log('[DEBUG] Message successfully inserted into messages table.')

      return res.status(200).json({
        status: 'success',
        messageId: message.messageId,
        message: `Your message has been sent to ${message.recipient}`
      })
    } catch (error) {
      Logger.error('[ERROR] Internal Server Error:', error)
      return res.status(500).json({ status: 'error', code: 'ERR_INTERNAL', description: 'An internal error has occurred.' })
    }
  }
}

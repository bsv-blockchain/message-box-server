import { Request, Response } from 'express'
import knexConfig from '../../knexfile.js'
import * as knexLib from 'knex'
import { PublicKey } from '@bsv/sdk'
import { webcrypto } from 'crypto'
import { Logger } from '../utils/logger.js'

(global as any).self = { crypto: webcrypto }

const { NODE_ENV = 'development', SERVER_PRIVATE_KEY } = process.env

const knex: knexLib.Knex = (knexLib as any).default?.(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
) ?? (knexLib as any)(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
)

interface Message {
  recipient: string
  messageBox: string
  messageId: string
  body: string
}

interface SendMessageRequestBody {
  message?: Message
  priority?: boolean
  payment?: { satoshisPaid: number }
}

interface SendMessageRequest extends Request {
  auth: { identityKey: string }
  body: SendMessageRequestBody
}

// Ensure SERVER_PRIVATE_KEY is available
if (SERVER_PRIVATE_KEY == null || SERVER_PRIVATE_KEY.trim() === '') {
  throw new Error('SERVER_PRIVATE_KEY is not defined in the environment variables.')
}

export function calculateMessagePrice (message: string, priority: boolean = false): number {
  const basePrice = 2 // Base fee in satoshis
  const sizeFactor = Math.ceil(Buffer.byteLength(message, 'utf8') / 1024) * 3 // 50 satoshis per KB

  return basePrice + sizeFactor
}

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
  // middleware: [paymentMiddleware], // Attach paymentMiddleware here

  func: async (req: SendMessageRequest, res: Response): Promise<Response> => {
    try {
      // Logger.log('[DEBUG] Processing /sendMessage request...')
      // Logger.log('[DEBUG] Request Headers:', JSON.stringify(req.headers, null, 2))
      // Logger.log('[DEBUG] Request Body:', JSON.stringify(req.body ?? {}, null, 2))
      const { message } = req.body // Ensure message is extracted properly
      if (message == null) {
        Logger.error('[ERROR] No message provided in request body!')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGE_REQUIRED',
          description: 'Please provide a valid message to send!'
        })
      }

      // **Validate Message Structure**
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
      if (typeof message.body !== 'string' || message.body.trim() === '') {
        return res.status(400).json({ status: 'error', code: 'ERR_INVALID_MESSAGE_BODY', description: 'Invalid message body.' })
      }

      Logger.log('[DEBUG] Validating recipient key:', message.recipient)
      try {
        PublicKey.fromString(message.recipient)
        Logger.log('[DEBUG] Parsed Recipient Public Key Successfully:', message.recipient)
      } catch (error) {
        return res.status(400).json({ status: 'error', code: 'ERR_INVALID_RECIPIENT_KEY', description: 'Invalid recipient key format.' })
      }

      Logger.log(`[DEBUG] Storing message for recipient: ${message.recipient}`)

      // **Retrieve or Create MessageBox**
      let messageBox = await knex('messageBox')
        .where({ identityKey: message.recipient, type: message.messageBox })
        .first()

      if (messageBox == null) {
        Logger.log('[DEBUG] No local messageBox found. Attempting overlay lookup...')

        const overlayAd: { host: string } | undefined = await knex('overlay_ads')
          .where({ identity_key: message.recipient })
          .orderBy('created_at', 'desc')
          .first()

        if (typeof overlayAd?.host === 'string' && overlayAd.host.trim() !== '') {
          Logger.log(`[OVERLAY] Forwarding message to remote host: ${overlayAd.host}`)
          const response = await fetch(`${overlayAd.host}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-bsv-auth-identity-key': req.auth?.identityKey ?? ''
            },
            body: JSON.stringify({ message })
          })

          if (!response.ok) {
            const error = await response.text()
            Logger.error('[OVERLAY] Remote host returned error:', error)
            return res.status(502).json({
              status: 'error',
              code: 'ERR_REMOTE_SEND_FAILED',
              description: error
            })
          }

          const data = await response.json()
          return res.status(200).json({
            status: 'success',
            forwarded: true,
            host: overlayAd.host,
            data
          })
        }

        Logger.warn('[OVERLAY] No overlay ad found. Creating messageBox locally...')
        await knex('messageBox').insert({
          identityKey: message.recipient,
          type: message.messageBox,
          created_at: new Date(),
          updated_at: new Date()
        })
      }

      // **Get the messageBoxId**
      messageBox = await knex('messageBox')
        .where({ identityKey: message.recipient, type: message.messageBox })
        .select('messageBoxId')
        .first()

      // **Insert the message into the messages table**
      Logger.log('[DEBUG] Inserting message into messages table...')
      try {
        const messageBoxId = messageBox?.messageBoxId ?? null // Ensure valid messageBoxId

        await knex('messages')
          .insert({
            messageId: message.messageId,
            messageBoxId,
            sender: req.auth?.identityKey ?? null,
            recipient: message.recipient,
            body: message.body,
            created_at: new Date(),
            updated_at: new Date()
          })
          .onConflict('messageId') // If `messageId` already exists...
          .ignore() // Ignore the duplicate error
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

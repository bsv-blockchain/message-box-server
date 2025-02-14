import { Request, Response } from 'express'
import knexConfig from '../../knexfile.js'
import knexLib, { Knex } from 'knex'
import { createPaymentMiddleware } from '@bsv/payment-express-middleware'
import { calculateMessagePrice } from '../utils/payment.js'

const { NODE_ENV = 'development' } = process.env

const knex: Knex = knexLib.default(
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

interface SendMessageRequest extends Request {
  authrite: { identityKey: string }
  body: { message?: Message }
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
  exampleResponse: {
    status: 'success'
  },
  func: async (req: SendMessageRequest, res: Response): Promise<Response> => {
    try {
      const { message } = req.body

      // Request Body Validation
      if (message == null) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGE_REQUIRED',
          description: 'Please provide a valid message to send!'
        })
      }
      if (typeof message !== 'object') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGE',
          description: 'Message properties must be contained in a message object!'
        })
      }
      if (message.recipient === undefined || message.recipient === null || typeof message.recipient !== 'string' || message.recipient.trim() === '') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_RECIPIENT',
          description: 'Recipient must be a compressed public key formatted as a hex string!'
        })
      }
      if (message.messageId === undefined || message.messageId === null || typeof message.messageId !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGEID',
          description: 'Please provide a unique counterparty-specific messageID!'
        })
      }
      if (message.body === undefined || message.body === null) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGE_BODY_REQUIRED',
          description: 'Message body is required!'
        })
      } else if (typeof message.messageBox !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGEBOX',
          description: 'MessageBox must be a string!'
        })
      }

      if (message.body === undefined || message.body === null || typeof message.body !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGE_BODY',
          description: 'Message body must be formatted as a string!'
        })
      }

      // Select the message box to send this message to
      // eslint-disable-next-line prefer-const
      const messageBox = await knex('messageBox')
        .where({
          identityKey: message.recipient,
          type: message.messageBox
        })
        .update({ updated_at: new Date() })

      // If this messageBox does not exist yet, create it
      if (messageBox === undefined || messageBox === 0) {
        await knex('messageBox').insert({
          identityKey: message.recipient,
          type: message.messageBox,
          created_at: new Date(),
          updated_at: new Date()
        })
      }

      // Select the newly updated/created messageBox Id
      const [messageBoxRecord] = await knex('messageBox')
        .where({
          identityKey: message.recipient,
          type: message.messageBox
        })
        .select('messageBoxId')

      // Ensure messageBox exists before inserting the message
      if (messageBoxRecord === undefined || messageBoxRecord === null) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGEBOX_NOT_FOUND',
          description: 'The specified messageBox does not exist.'
        })
      }

      // Insert the new message
      try {
        await knex('messages').insert({
          messageId: message.messageId,
          messageBoxId: messageBoxRecord.messageBoxId, // Foreign key
          sender: req.authrite.identityKey,
          recipient: message.recipient,
          body: message.body,
          created_at: new Date(),
          updated_at: new Date()
        })
      } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({
            status: 'error',
            code: 'ERR_DUPLICATE_MESSAGE',
            description: 'Your message has already been sent to the intended recipient!'
          })
        }
        throw error
      }

      return res.status(200).json({
        status: 'success',
        message: `Your message has been sent to ${message.recipient}`
      })
    } catch (e) {
      console.error(e)
      if (globalThis.Bugsnag != null) globalThis.Bugsnag.notify(e)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}

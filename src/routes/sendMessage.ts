import { Request, Response } from 'express'
import knexConfig from '../../knexfile.js'
import * as knexLib from 'knex'
import { createPaymentMiddleware } from '@bsv/payment-express-middleware'
import { ProtoWallet, PrivateKey, PublicKey } from '@bsv/sdk'
import { webcrypto } from 'crypto'

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
if (SERVER_PRIVATE_KEY === undefined || SERVER_PRIVATE_KEY === null || SERVER_PRIVATE_KEY.trim() === '') {
  throw new Error('SERVER_PRIVATE_KEY is not defined in the environment variables.')
}

const privateKey = PrivateKey.fromRandom()
console.log('[DEBUG] Generated Private Key:', privateKey.toHex())
const wallet = new ProtoWallet(privateKey)

export function calculateMessagePrice(message: string, priority: boolean = false): number {
  const basePrice = 500 // Base fee in satoshis
  const sizeFactor = Math.ceil(Buffer.byteLength(message, 'utf8') / 1024) * 50 // 50 satoshis per KB
  const priorityFee = priority ? 200 : 0 // Additional fee for priority messages

  return basePrice + sizeFactor + priorityFee
}

// Create Payment Middleware
// const paymentMiddleware = createPaymentMiddleware({
//   wallet,
//   calculateRequestPrice: async (req) => {
//     const body = req.body as SendMessageRequestBody
//     if (
//       body === undefined ||
//       body === null ||
//       body.message === undefined ||
//       body.message === null ||
//       body.message.body === undefined ||
//       body.message.body === null ||
//       body.message.body.trim() === ''
//     ) {
//       return 0 // Free if there's no valid message body
//     }
//     return calculateMessagePrice(body.message.body, body.priority ?? false)
//   }
// })

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
    console.log('[DEBUG] Processing /sendMessage request...')
    console.log('[DEBUG] Request Headers:', JSON.stringify(req.headers, null, 2))
    console.log('[DEBUG] Request Body:', JSON.stringify(req.body, null, 2))

    try {
      // **Explicitly check the Payment field**
      // const { payment } = req.body

      // console.log('[DEBUG] Checking payment field:', JSON.stringify(payment, null, 2))

      // if (payment === undefined || payment === null || payment.satoshisPaid === undefined) {
      //   console.error('[ERROR] Payment is required but missing! Received:', JSON.stringify(payment, null, 2))
      //   return res.status(402).json({
      //     status: 'error',
      //     code: 'ERR_PAYMENT_REQUIRED',
      //     description: 'Payment is required before sending messages. Ensure the correct payment field is provided.'
      //   })
      // }

      // console.log(`[DEBUG] Payment verified: ${payment.satoshisPaid} satoshis paid.`)

      const { message } = req.body
      if (message === undefined || message === null) {
        console.error('[ERROR] No message provided in request body!')
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGE_REQUIRED',
          description: 'Please provide a valid message to send!'
        })
      }

      console.log('[DEBUG] Message Details:', JSON.stringify(message, null, 2))

      if (
        message.recipient === undefined ||
        message.recipient === null ||
        typeof message.recipient !== 'string' ||
        message.recipient.trim() === ''
      ) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_RECIPIENT',
          description: 'Recipient must be a compressed public key formatted as a hex string!'
        })
      }

      console.log(`[DEBUG] Validating recipient key: ${message.recipient}`)
      try {
        const recipientPublicKey = PublicKey.fromString(message.recipient)
        console.log('[DEBUG] Parsed Recipient Public Key Successfully:', recipientPublicKey.toString())
      } catch (error) {
        console.error('[ERROR] Failed to parse recipient identity key:', error)
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_RECIPIENT_KEY',
          description: 'Recipient identity key format is invalid.'
        })
      }

      console.log(`[DEBUG] Storing message for recipient: ${message.recipient}`)

      const messageBox = await knex('messageBox')
        .where({ identityKey: message.recipient, type: message.messageBox })
        .update({ updated_at: new Date() })

      if (messageBox === 0 || isNaN(messageBox)) {
        console.log('[DEBUG] MessageBox not found, creating a new one...')
        await knex('messageBox').insert({
          identityKey: message.recipient,
          type: message.messageBox,
          created_at: new Date(),
          updated_at: new Date()
        })
      }

      // Insert the new message
      // try {
      await knex('messages').insert({
        messageId: message.messageId,
        messageBoxId: messageBox, // Foreign key?
        sender: req.auth.identityKey,
        recipient: message.recipient,
        body: message.body, // support binary in the future
        created_at: new Date(),
        updated_at: new Date()
      })
      // TODO
      // } catch (error) {
      // if (error.code === 'ER_DUP_ENTRY') {
      //   return res.status(400).json({
      //     status: 'error',
      //     code: 'ERR_DUPLICATE_MESSAGE',
      //     description: 'Your message has already been sent to the intended recipient!'
      //   })
      // }
      // throw error
      // }

      console.log('[DEBUG] Message successfully stored.')

      console.log('[DEBUG] Sending success response to client...')
      console.log('[DEBUG] Sending response:', {
        status: 'success',
        messageId: message.messageId ?? '',
        message: `Your message has been sent to ${message.recipient}`
      })

      try {
        const jsonResponse = {
          status: 'success',
          messageId: message.messageId ?? '',
          message: `Your message has been sent to ${message.recipient}`
        }

        console.log('[DEBUG] Sending response:', JSON.stringify(jsonResponse, null, 2))

        return res.status(200).json(jsonResponse)
      } catch (error) {
        console.error('[ERROR] Response sending failed:', error)
        return res.status(500).json({
          status: 'error',
          code: 'ERR_INTERNAL',
          description: 'An internal error occurred while sending the response.'
        })
      }
    } catch (error) {
      console.error('[ERROR] Internal Server Error:', error)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}

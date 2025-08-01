/**
 * @file sendMessage.ts
 * @description
 * Route handler to send a message to another identity's messageBox.
 * This route is used for P2P communication in the MessageBox system.
 *
 * It handles:
 * - Validation of message structure
 * - Validation of the recipient public key
 * - MessageBox creation if one doesn't exist
 * - Insertion of the message into the database
 * - Deduplication based on messageId
 *
 */

import { Response } from 'express'
import knexConfig from '../../knexfile.js'
import * as knexLib from 'knex'
import { AtomicBEEF, AtomicBEEF, PubKeyHex, PublicKey } from '@bsv/sdk'
import { Logger } from '../utils/logger.js'
import { AuthRequest } from '@bsv/auth-express-middleware'
import { sendFCMNotification } from '../utils/sendFCMNotification.js'
import { EncryptedNotificationPayload, NotificationPayment } from '../types/notifications.js'
import { calculateMessageFees, shouldUseFCMDelivery } from '../utils/messagePermissions.js'
import { getWallet } from 'src/app.js'

// Determine the environment (default to development)
const { NODE_ENV = 'development', SERVER_PRIVATE_KEY } = process.env

/**
 * Knex instance connected based on environment (development, production, or staging).
 */
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
export interface Message {
  recipient: PubKeyHex
  messageBox: string
  messageId: string
  body: string | {
    encrypted_payload?: EncryptedNotificationPayload
    payment?: NotificationPayment
  }
}

// Extended Express request type with authentication
export interface SendMessageRequest extends AuthRequest {
  body: {
    message?: Message
    payment?: {
      amount: number
      deliveryFee: number
      recipientFee: number
      outputs: any[]
      tx?: AtomicBEEF
    }
  }
}

// Validate critical server-side secret
if (SERVER_PRIVATE_KEY == null || SERVER_PRIVATE_KEY.trim() === '') {
  throw new Error('SERVER_PRIVATE_KEY is not defined in the environment variables.')
}

/**
 * @function calculateMessagePrice
 * @description Determines the price (in satoshis) to send a message, optionally with priority.
 */
export function calculateMessagePrice(message: string, priority: boolean = false): number {
  const basePrice = 2 // Base fee in satoshis
  const sizeFactor = Math.ceil(Buffer.byteLength(message, 'utf8') / 1024) * 3 // Satoshis per KB

  return basePrice + sizeFactor
}

/**
 * @openapi
 * /sendMessage:
 *   post:
 *     summary: Send a message to a recipient’s message box
 *     description: |
 *       Inserts a message into the target recipient’s message box on the server.
 *       The recipient, message box name, and message ID must be provided.
 *     tags:
 *       - Message
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: object
 *                 required:
 *                   - recipient
 *                   - messageBox
 *                   - messageId
 *                   - body
 *                 properties:
 *                   recipient:
 *                     type: string
 *                     description: Identity key of the recipient
 *                   messageBox:
 *                     type: string
 *                     description: The name of the recipient's message box
 *                   messageId:
 *                     type: string
 *                     description: Unique identifier for the message (usually an HMAC)
 *                   body:
 *                     oneOf:
 *                       - type: string
 *                       - type: object
 *                     description: The message content
 *     responses:
 *       200:
 *         description: Message stored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 messageId:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request or duplicate message
 *       500:
 *         description: Internal server error
 */

/**
 * @exports
 * Express-compatible route definition for `/sendMessage`, used to send messages to other users.
 * Contains metadata for auto-generation of route documentation and Swagger/OpenAPI integration.
 */
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
   * @description
   * Main request handler for sending a message to another user's MessageBox.
   *
   * Input:
   * - `req.body.message`: The message object with recipient, box, ID, and body.
   * - `req.auth.identityKey`: Authenticated user's identity key.
   *
   * Behavior:
   * - Validates message structure and content.
   * - Ensures recipient public key is valid.
   * - Ensures the messageBox exists for the recipient, or creates it.
   * - Inserts the message into the DB unless it's a duplicate.
   *
   * Output:
   * - 200: Success response with messageId and confirmation.
   * - 400: Structured validation error with reason code.
   * - 500: Internal server error for unexpected failures.
   *
   * @param {SendMessageRequest} req - Authenticated request with the message to send
   * @param {Response} res - Express response object
   * @returns {Promise<Response>} JSON response
   */
  func: async (req: SendMessageRequest, res: Response): Promise<Response> => {
    Logger.log('[DEBUG] Processing /sendMessage request...')
    Logger.log('[DEBUG] Request Headers:', JSON.stringify(req.headers, null, 2))
    Logger.log('[DEBUG] Request Body:', JSON.stringify(req.body, null, 2))

    if (req.auth?.identityKey == null) {
      return res.status(401).json({
        status: 'error',
        code: 'ERR_AUTH_REQUIRED',
        description: 'Authentication required'
      })
    }

    const wallet = await getWallet()

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
        console.error('[ERROR] Invalid message body:', message.body)
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

      const senderKey = req.auth?.identityKey
      if (senderKey == null) {
        return res.status(401).json({ status: 'error', code: 'ERR_UNAUTHORIZED', description: 'Unauthorized' })
      }

      try {
        // Parse payment amount from the request if present
        let paymentAmount = 0
        const payment = req.body.payment
        if (payment?.amount != null) {
          paymentAmount = payment.amount
        }

        Logger.log(`[DEBUG] Checking permissions for ${senderKey} -> ${message.recipient} (${message.messageBox})`)

        // Calculate fees and check permissions (this will auto-create box-wide defaults)
        const feeResult = await calculateMessageFees(
          message.recipient,
          senderKey,
          message.messageBox,
          paymentAmount
        )

        if (feeResult.allowed === false) {
          Logger.log(`[DEBUG] Message delivery blocked: ${feeResult.blocked_reason}`)
          return res.status(403).json({
            status: 'error',
            code: 'ERR_DELIVERY_BLOCKED',
            description: feeResult.blocked_reason ?? 'Message delivery not allowed',
            fee_info: {
              delivery_fee: feeResult.delivery_fee,
              recipient_fee: feeResult.recipient_fee,
              total_required: feeResult.total_cost,
              payment_provided: paymentAmount
            }
          })
        }

        // Handle payment validation and internalization BEFORE storing message
        if (feeResult.requires_payment === true) {
          Logger.log(`[DEBUG] Message requires payment: ${paymentAmount} >= ${feeResult.total_cost} required`)

          // Validate payment is provided and sufficient
          if (paymentAmount < feeResult.total_cost) {
            Logger.log(`[DEBUG] Insufficient payment: ${paymentAmount} < ${feeResult.total_cost} required`)
            return res.status(402).json({
              status: 'error',
              code: 'ERR_INSUFFICIENT_PAYMENT',
              description: `Payment required: ${feeResult.total_cost} satoshis, but only ${paymentAmount} provided`,
              fee_info: {
                delivery_fee: feeResult.delivery_fee,
                recipient_fee: feeResult.recipient_fee,
                total_required: feeResult.total_cost,
                payment_provided: paymentAmount
              }
            })
          }

          // Internalize payment BEFORE storing message
          Logger.log(`[DEBUG] Internalizing payment of ${paymentAmount} satoshis (delivery: ${feeResult.delivery_fee}, recipient: ${feeResult.recipient_fee})`)
          const internalizeResult = await wallet.internalizeAction({
            tx: payment?.tx,
            outputs: [{
              outputIndex: 0,
              protocol: 'wallet payment',
              paymentRemittance: {
                derivationPrefix: payment?.outputs[0].derivationPrefix,
                derivationSuffix: payment?.outputs[0].derivationSuffix,
                senderIdentityKey: req.auth?.identityKey
              }
            }, {
              outputIndex: 1,
              protocol: 'wallet payment',
              paymentRemittance: {
                derivationPrefix: payment?.outputs[1].derivationPrefix,
                derivationSuffix: payment?.outputs[1].derivationSuffix,
                senderIdentityKey: req.auth?.identityKey
              }
            }],
            description: 'MessageBox delivery payment',
            labels: ['messagebox', 'delivery-payment']
          })

          if (!internalizeResult.accepted) {
            return res.status(400).json({
              status: 'error',
              code: 'ERR_INSUFFICIENT_PAYMENT',
              description: 'Payment was not accepted! Contact the server host for more information.'
            })
          }

          Logger.log('[DEBUG] Payment validated and internalized successfully')
        } else {
          Logger.log('[DEBUG] Message delivery is free - no payment required')
        }
      } catch (permissionError) {
        Logger.error('[ERROR] Error checking message permissions:', permissionError)
        return res.status(500).json({
          status: 'error',
          code: 'ERR_PERMISSION_CHECK_FAILED',
          description: 'Failed to check message permissions'
        })
      }

      // Permission check passed - now store the message
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
            sender: req.auth?.identityKey,
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

      Logger.log('[DEBUG] Message successfully stored after permission and payment validation.')

      // Handle post-storage processing (FCM delivery)
      try {
        if (shouldUseFCMDelivery(message.messageBox) === true) {
          Logger.log('[DEBUG] Processing message for FCM delivery...')

          // Send the complete message through FCM (encrypted message + payment)
          const fcmPayload = {
            title: 'New Message',
            body: 'You have received an encrypted message',

            // Include the complete original message data
            data: {
              // Send the entire request body so recipient gets encrypted message + payment
              message: JSON.stringify(req.body),
              messageId: message.messageId,
              messageBox: message.messageBox,
              timestamp: Date.now().toString(),

              // Payment information if present
              ...(typeof message.body === 'object' && message.body.payment != null && {
                hasPayment: 'true',
                paymentAmount: message.body.payment.amount?.toString() ?? '0'
              })
            }
          }

          Logger.log(`[DEBUG] Sending FCM with complete message data for ${message.messageId}`)

          // Send FCM notification with complete message
          const notificationResult = await sendFCMNotification(message.recipient, fcmPayload)

          if (notificationResult.success) {
            Logger.log(`[DEBUG] FCM notification sent successfully: ${notificationResult.messageId}`)
          } else {
            Logger.log(`[DEBUG] FCM notification failed: ${notificationResult.error || 'Unknown error'}`)
          }
        }
      } catch (deliveryError) {
        // Log delivery errors but don't fail the message send (message is already stored)
        Logger.error('[ERROR] Error processing FCM delivery:', deliveryError)
      }

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

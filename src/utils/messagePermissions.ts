import knexConfig from '../../knexfile.js'
import * as knexLib from 'knex'
import { Logger } from './logger.js'
import { PubKeyHex } from '@bsv/sdk'

// Determine the environment (default to development)
const { NODE_ENV = 'development' } = process.env

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

/**
 * Fee calculation result structure
 */
export interface FeeCalculationResult {
  delivery_fee: number
  recipient_fee: number
  total_cost: number
  allowed: boolean
  requires_payment: boolean
  blocked_reason?: string
}

/**
 * Calculate message fees and check permissions
 */
export async function calculateMessageFees(
  recipient: PubKeyHex,
  sender: PubKeyHex | null,
  messageBox: string,
  paymentAmount: number = 0
): Promise<FeeCalculationResult> {
  try {
    const deliveryFee = await getServerDeliveryFee(messageBox)
    const recipientFee = await getRecipientFee(recipient, sender, messageBox)

    // Check if blocked (0) or always allowed (-1)
    if (recipientFee === 0) {
      return {
        delivery_fee: deliveryFee,
        recipient_fee: recipientFee,
        total_cost: 0,
        allowed: false,
        requires_payment: false,
        blocked_reason: 'Sender is blocked by recipient'
      }
    }

    // Always allow (-1) - only charge delivery fee
    if (recipientFee === -1) {
      const totalCost = deliveryFee
      const requiresPayment = totalCost > 0
      const allowed = !requiresPayment || paymentAmount >= totalCost

      return {
        delivery_fee: deliveryFee,
        recipient_fee: recipientFee, // Pass the value set to higher layers
        total_cost: totalCost,
        allowed,
        requires_payment: requiresPayment,
        ...(requiresPayment && paymentAmount < totalCost && {
          blocked_reason: `Insufficient payment: ${paymentAmount} < ${totalCost} required`
        })
      }
    }

    const totalCost = deliveryFee + recipientFee
    const requiresPayment = totalCost > 0
    const allowed = !requiresPayment || paymentAmount >= totalCost

    return {
      delivery_fee: deliveryFee,
      recipient_fee: recipientFee,
      total_cost: totalCost,
      allowed,
      requires_payment: requiresPayment,
      ...(requiresPayment && paymentAmount < totalCost && {
        blocked_reason: `Insufficient payment: ${paymentAmount} < ${totalCost} required`
      })
    }
  } catch (error) {
    Logger.error('[ERROR] Error calculating message fees:', error)
    return {
      delivery_fee: 0,
      recipient_fee: 0,
      total_cost: 0,
      allowed: false,
      requires_payment: false,
      blocked_reason: 'Error calculating fees'
    }
  }
}

/**
 * Get server delivery fee for a message box type
 */
export async function getServerDeliveryFee(messageBox: string): Promise<number> {
  try {
    const serverFee = await knex('server_fees')
      .where('message_box', messageBox)
      .select('delivery_fee')
      .first()

    return serverFee?.delivery_fee ?? 0
  } catch (error) {
    Logger.error('[ERROR] Error getting server delivery fee:', error)
    return 0
  }
}

/**
 * Get recipient fee for a sender/messageBox combination with hierarchical fallback
 */
export async function getRecipientFee(
  recipient: PubKeyHex,
  sender: PubKeyHex | null,
  messageBox: string
): Promise<number> {
  try {
    // First try sender-specific permission
    if (sender != null) {
      const senderSpecific = await knex('message_permissions')
        .where({
          recipient,
          sender,
          message_box: messageBox
        })
        .select('recipient_fee')
        .first()

      if (senderSpecific != null) {
        return senderSpecific.recipient_fee
      }
    }

    // Fallback to box-wide default
    const boxWideDefault = await knex('message_permissions')
      .where({
        recipient,
        sender: null, // Box-wide default
        message_box: messageBox
      })
      .select('recipient_fee')
      .first()

    if (boxWideDefault != null) {
      return boxWideDefault.recipient_fee
    }

    // Auto-create box-wide default if none exists
    const defaultFee = getSmartDefaultFee(messageBox)
    await knex('message_permissions').insert({
      recipient,
      sender: null,
      message_box: messageBox,
      recipient_fee: defaultFee,
      created_at: new Date(),
      updated_at: new Date()
    })

    Logger.log(`[DEBUG] Created box-wide default permission for ${recipient}/${messageBox} with fee ${defaultFee}`)
    return defaultFee
  } catch (error) {
    Logger.error('[ERROR] Error getting recipient fee:', error)
    return 0 // Block on error
  }
}

/**
 * Get smart default fee based on message box type
 */
function getSmartDefaultFee(messageBox: string): number {
  // Notifications are premium service
  if (messageBox === 'notifications') {
    return 10 // 10 satoshis
  }

  // Other message boxes are always allowed by default
  return -1
}

/**
 * Set message permission for a sender/recipient/messageBox combination
 */
export async function setMessagePermission(
  recipient: PubKeyHex,
  sender: PubKeyHex | null,
  messageBox: string,
  recipientFee: number
): Promise<boolean> {
  try {
    const now = new Date()

    // Use upsert (insert or update)
    await knex('message_permissions')
      .insert({
        recipient,
        sender,
        message_box: messageBox,
        recipient_fee: recipientFee,
        created_at: now,
        updated_at: now
      })
      .onConflict(['recipient', 'sender', 'message_box'])
      .merge({
        recipient_fee: recipientFee,
        updated_at: now
      })

    return true
  } catch (error) {
    Logger.error('[ERROR] Error setting message permission:', error)
    return false
  }
}

/**
 * Check if FCM delivery should be used for this message box
 */
export function shouldUseFCMDelivery(messageBox: string): boolean {
  return messageBox === 'notifications'
}

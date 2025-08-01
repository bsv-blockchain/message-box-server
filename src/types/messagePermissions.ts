import { PubKeyHex } from '@bsv/sdk'

// Generalized message permission for any box/sender combination
export interface MessagePermission {
  id: number
  recipient: PubKeyHex // identityKey of permission owner
  sender: PubKeyHex | null // identityKey of sender (null for box-wide defaults)
  message_box: string // messageBox type (e.g., 'notifications', 'inbox', etc.)
  recipient_fee: number // -1 = block, 0 = free, >0 = satoshi amount required
  created_at: Date
  updated_at: Date
}

// Server fee configuration for different message box types
export interface ServerFee {
  id: number
  message_box: string // messageBox type
  delivery_fee: number // Server delivery fee in satoshis
  created_at: Date
  updated_at: Date
}

// Combined fee structure for a specific box/sender combination
export interface MessageFeeStructure {
  message_box: string
  sender: PubKeyHex
  recipient: PubKeyHex
  delivery_fee: number // What server charges
  recipient_fee: number // What recipient requires
  total_cost: number // Sum of both fees
  allowed: boolean // Whether message delivery is allowed
  blocked_reason?: string // Why delivery is blocked if applicable
}

// Request to set message permissions
export interface SetMessagePermissionRequest {
  sender: PubKeyHex // identityKey of sender
  message_box: string // messageBox type
  recipient_fee: number // -1 = block, 0 = free, >0 = satoshi amount required
}

// Response for listing message permissions
export interface MessagePermissionListResponse {
  permissions: Array<{
    sender: PubKeyHex
    message_box: string
    recipient_fee: number
    created_at: string
    updated_at: string
  }>
  total: number
  page: number
  per_page: number
}

// Quote response for sending to a specific box/sender combination
export interface MessageQuoteResponse {
  sender: PubKeyHex
  recipient: PubKeyHex
  message_box: string
  delivery_allowed: boolean
  delivery_fee: number // Server fee
  recipient_fee: number // Recipient's required fee
  total_cost: number // Combined cost
  permission_status: 'allowed' | 'blocked' | 'payment_required' | 'no_permission'
  description: string
  currency: string
  valid_until: string
}

// Fee calculation result
export interface FeeCalculationResult {
  delivery_fee: number
  recipient_fee: number
  total_cost: number
  allowed: boolean
  requires_payment: boolean
  blocked_reason?: string
}

import { PubKeyHex } from '@bsv/sdk'

// Notification permission types
export interface NotificationPermission {
  id: number
  recipient: PubKeyHex // identityKey of permission owner
  sender: PubKeyHex // identityKey of sender
  allowed: number // -1 = allow all, 0 = block all, 1+ = min payment threshold
  created_at: Date
  updated_at: Date
}

// TODO: Determine payload structure for notifications
export interface EncryptedNotificationPayload {
  title?: string // Optional unencrypted title for display
}

// Optional payment structure
export interface NotificationPayment {
  amount: number // Satoshis
  recipient: PubKeyHex
  // TODO: Add more payment fields as needed for internalizeAction
}

// Combined notification message structure
export interface NotificationMessage {
  recipient: PubKeyHex
  messageBox: 'notifications' // Must be 'notifications' for push notification handling
  messageId: string
  body: {
    encrypted_payload: EncryptedNotificationPayload
    payment?: NotificationPayment // Optional payment
  }
}

// FCM configuration interface (adapted from Jackie's code)
export interface FCMPayload {
  title: string
  body: string
  icon?: string
  badge?: number
  data?: Record<string, string>
}

export interface SendNotificationResult {
  success: boolean
  messageId: string
}

// Permission check result
export interface PermissionCheckResult {
  allowed: boolean
  permission_value: number // The numerical value from the 'allowed' field
  required_payment?: number // Calculated based on permission_value if > 0
}

// API request/response types
export interface AllowNotificationRequest {
  sender: PubKeyHex // identityKey of sender
  allowed: number // -1, 0, or positive number for payment threshold
}

export interface PermissionListResponse {
  permissions: Array<{
    sender: PubKeyHex | null
    allowed: number
    created_at: string
    updated_at: string
  }>
  total: number
  page: number
  per_page: number
}

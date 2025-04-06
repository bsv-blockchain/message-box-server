import { Request } from 'express'

export interface AuthenticatedRequest extends Request {
  auth: {
    identityKey: string
  }
}

/**
 * Advertisement structure — published by a host on behalf of an identityKey.
 */
export interface Advertisement {
  identityKey: string
  host: string
  timestamp: number
  nonce: string
  signature: string
  txid?: string
  created_at?: Date // stored in DB, not needed in broadcast payload
}

/**
 * Structure of a routed/relayed message.
 */
export interface Message {
  messageId: string
  messageBox: string
  body: string
  sender: string
  recipient: string
  created_at?: Date
  updated_at?: Date
}

/**
 * Response structure for forwarded messages.
 */
export interface ForwardResult {
  forwarded: boolean
  host?: string
}

export interface OverlayAdRow {
  identity_key: string
  host: string
  timestamp: number
  nonce: string
  signature: string
  txid: string
  created_at: Date
}

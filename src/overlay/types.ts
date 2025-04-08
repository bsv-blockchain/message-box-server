import { Request } from 'express'

export interface AuthenticatedRequest extends Request {
  auth: {
    identityKey: string
  }
}

export interface AdvertisementBase {
  identityKey: string
  host: string
  timestamp: string | Date
  nonce: string
  signature: string
}

// What’s broadcasted over the wire (includes protocol/version)
export interface Advertisement extends AdvertisementBase {
  protocol: string
  version: string
  txid?: string
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
  timestamp: string
  nonce: string
  signature: string
  txid: string
  created_at: Date
}

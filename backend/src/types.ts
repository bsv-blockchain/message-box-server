import { Request } from 'express'

/**
 * An Express request that includes an authenticated identityKey.
 */
export interface AuthenticatedRequest extends Request {
  auth: {
    identityKey: string
  }
}

/**
 * Base structure of an advertisement before protocol metadata is applied.
 * Represents a user's approval for a host to receive their messages.
 */
export interface AdvertisementBase {
  identityKey: string
  host: string
  timestamp: string | Date
  nonce: string
  signature: string
}

/**
 * Complete structure of an overlay advertisement, including protocol and version metadata.
 * Optionally includes a txid once broadcasted on the overlay network.
 */
export interface Advertisement extends AdvertisementBase {
  protocol: string
  version: string
  txid?: string
}

/**
 * Structure of a routed/relayed message sent through messagebox.
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
 * Response structure indicating whether a message was successfully forwarded to a remote host.
 */
export interface ForwardResult {
  forwarded: boolean
  host?: string
}

/**
 * Representation of a row in the `messagebox_advertisement` database table.
 */
export interface OverlayAdRow {
  identitykey: string
  host: string
  timestamp: string
  nonce: string
  signature: string
  txid: string
  created_at: Date
}

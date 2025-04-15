/**
 * Represents a message sent between peers, stored in a message box.
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
 * Represents a signed advertisement used in the overlay network
 * to announce which host is anointed to represent a specific identity key.
 */
export interface Advertisement {
  identityKey: string
  host: string
  timestamp: string | Date
  nonce: string
  signature: string
  txid?: string
  created_at?: Date
}

/**
 * Contract for any storage mechanism used to manage overlay advertisements.
 * Supports looking up, saving, and listing advertisements for identity-host mappings.
 */
export interface MessageBoxStorageContract {
  getLatestHostFor: (identityKey: string) => Promise<string | null>
  storeAdvertisement: (ad: Advertisement) => Promise<void>
  listRecentAds: (limit?: number) => Promise<Advertisement[]>
}

/**
 * Contract for a lookup service that can resolve overlay behavior:
 * forwarding messages, listing them, and acknowledging receipt.
 */
export interface MessageBoxLookupServiceContract {
  forwardMessage: (message: Message, sender: string) => Promise<{ forwarded: boolean, host?: string } | null>
  listMessages: (identityKey: string, messageBox: string) => Promise<Message[] | null>
  acknowledgeMessages: (identityKey: string, messageIds: string[]) => Promise<{ acknowledged: boolean } | null>
}

/**
 * Contract for a manager responsible for broadcasting, rebroadcasting,
 * and retrieving advertisements for overlay communication.
 */
export interface MessageBoxTopicManagerContract {
  broadcast: () => Promise<{ advertisement: Advertisement, txid: string }>
  rebroadcast: () => Promise<{ advertisement: Advertisement, txid: string }>
  listRecentAds: (limit?: number) => Promise<Advertisement[]>
}

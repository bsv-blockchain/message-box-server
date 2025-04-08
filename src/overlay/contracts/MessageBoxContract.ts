export interface Message {
  messageId: string
  messageBox: string
  body: string
  sender: string
  recipient: string
  created_at?: Date
  updated_at?: Date
}

export interface Advertisement {
  identityKey: string
  host: string
  timestamp: string | Date
  nonce: string
  signature: string
  txid?: string
  created_at?: Date
}

export interface MessageBoxStorageContract {
  getLatestHostFor: (identityKey: string) => Promise<string | null>
  storeAdvertisement: (ad: Advertisement) => Promise<void>
  listRecentAds: (limit?: number) => Promise<Advertisement[]>
}

export interface MessageBoxLookupServiceContract {
  forwardMessage: (message: Message, sender: string) => Promise<{ forwarded: boolean, host?: string } | null>
  listMessages: (identityKey: string, messageBox: string) => Promise<Message[] | null>
  acknowledgeMessages: (identityKey: string, messageIds: string[]) => Promise<{ acknowledged: boolean } | null>
}

export interface MessageBoxTopicManagerContract {
  broadcast: () => Promise<{ advertisement: Advertisement, txid: string }>
  rebroadcast: () => Promise<{ advertisement: Advertisement, txid: string }>
  listRecentAds: (limit?: number) => Promise<Advertisement[]>
}

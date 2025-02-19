import { Request } from 'express'

// Define Request Type
export interface AuthriteRequest extends Request {
  authrite: {
    identityKey: string
  }
  body: {
    messageIds?: string[] // Ensure string[] as expected
  }
}

export interface Message {
  messageId: string
  recipient: string
  messageBox: string
  body: string
}

export interface SendMessageRequest extends Request {
  authrite: { identityKey: string }
  body: {
    message?: Message
    priority?: boolean
  }
  payment?: { satoshisPaid?: number }
}

// Define Request Type
export interface AuthriteRequestMB extends Request {
  authrite: {
    identityKey: string
  }
  body: {
    messageBox?: string
  }
}

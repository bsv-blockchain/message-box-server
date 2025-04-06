import axios from 'axios'
import type { MessageBoxLookupServiceContract, Message } from '../contracts/MessageBoxContract.js'
import type { MessageBoxStorage } from './MessageBoxStorage.js'

export class MessageBoxLookupService implements MessageBoxLookupServiceContract {
  constructor (private readonly storage: MessageBoxStorage) {}

  async acknowledgeMessages (identityKey: string, messageIds: string[]): Promise<{ acknowledged: boolean } | null> {
    const host = await this.storage.getLatestHostFor(identityKey)
    if (host === null || host === '') {
      console.warn(`[OVERLAY] No anointed host found for ${identityKey}.`)
      return null
    }

    try {
      const response = await axios.post(`${host}/acknowledgeMessage`, {
        messageIds
      }, {
        headers: {
          Authorization: identityKey // TODO: Replace with signature-based auth
        }
      })

      if (response.data?.status === 'success') {
        return { acknowledged: true }
      }

      console.warn(`[OVERLAY] Acknowledgment request to ${host} failed with response:`, response.data)
    } catch (err) {
      console.warn('[OVERLAY] Remote acknowledgeMessage failed:', err)
    }

    return null
  }

  async listMessages (identityKey: string, messageBox: string): Promise<Message[] | null> {
    const host = await this.storage.getLatestHostFor(identityKey)
    if (host === null || host === '') {
      console.warn(`[OVERLAY] No anointed host found for ${identityKey}.`)
      return null
    }

    try {
      const response = await axios.post(`${host}/listMessages`, {
        messageBox
      }, {
        headers: {
          Authorization: identityKey // TODO: Replace with signature-based auth
        }
      })

      if (response.data?.status === 'success' && Array.isArray(response.data.messages)) {
        return response.data.messages
      }

      console.warn(`[OVERLAY] listMessages request to ${host} failed with response:`, response.data)
    } catch (error) {
      console.warn('[OVERLAY] Error while forwarding listMessages:', error)
    }

    return null
  }

  async forwardMessage (message: Message, sender: string): Promise<{ forwarded: boolean, host?: string } | null> {
    const host = await this.storage.getLatestHostFor(message.recipient)
    if (host === null || host === '') {
      console.warn(`[OVERLAY] No anointed host found for ${message.recipient}.`)
      return null
    }

    try {
      const response = await axios.post(`${host}/sendMessage`, {
        message
      }, {
        headers: {
          Authorization: sender // TODO: Replace with proper signed identity header
        }
      })

      if (response.data?.status === 'success') {
        return {
          forwarded: true,
          host
        }
      }

      console.warn(`[OVERLAY] sendMessage request to ${host} failed with response:`, response.data)
    } catch (error) {
      console.warn('[OVERLAY] Error while forwarding sendMessage:', error)
    }

    return null
  }
}

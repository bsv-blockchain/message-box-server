import axios from 'axios'
import type { MessageBoxLookupServiceContract, Message } from '../contracts/MessageBoxContract.js'
import type { MessageBoxStorage } from './MessageBoxStorage.js'

/**
 * Provides overlay routing and forwarding logic for messages in the MessageBox network.
 * This service uses stored advertisements to locate the host responsible for a recipient
 * and performs HTTP forwarding to remote hosts for sending, listing, and acknowledging messages.
 */
export class MessageBoxLookupService implements MessageBoxLookupServiceContract {
  constructor (private readonly storage: MessageBoxStorage) {}

  /**
   * Attempts to acknowledge a set of messages by forwarding the acknowledgment request
   * to the anointed host for the given identity key. Returns success if remote host confirms.
   *
   * @param identityKey - The identity key of the user acknowledging messages.
   * @param messageIds - The list of message IDs to acknowledge.
   * @returns An object indicating success, or null if no host is available or the request fails.
   */
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
          Authorization: identityKey
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

  /**
   * Retrieves messages for a specific identity key and message box from the overlay.
   * This is used when the local server has no matching messages and must query the remote host.
   *
   * @param identityKey - The identity key of the message recipient.
   * @param messageBox - The name/type of message box (e.g. "payment_inbox").
   * @returns A list of messages if available, or null if no host is found or the request fails.
   */
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
          Authorization: identityKey
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

  /**
   * Forwards a message to the anointed host of the intended recipient using the overlay.
   * This allows clients to send messages even when the recipient is hosted on a different server.
   *
   * @param message - The full message to forward (recipient, messageId, body, etc).
   * @param sender - The identity key of the sender, used for authorization.
   * @returns An object indicating success and the host used, or null on failure.
   */
  async forwardMessage (message: Message, sender: string): Promise<{ forwarded: boolean, host?: string } | null> {
    const host = await this.storage.getLatestHostFor(message.recipient)
    if (host === null || host === '') {
      console.warn(`[OVERLAY] No anointed host found for ${message.recipient}.`)
      return null
    }

    try {
      const response = await axios.post(`${host}/sendMessage`, {
        sender,
        message
      }, {
        headers: {
          Authorization: sender
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

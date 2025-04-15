import { LookupResolver } from '@bsv/sdk'
import type { MessageBoxLookupServiceContract, Message } from '../contracts/MessageBoxContract.js'

/**
 * Provides SHIP-based overlay routing logic for MessageBox using LookupResolver.
 * This version no longer relies on local database storage or HTTP endpoints.
 */
export class MessageBoxLookupService implements MessageBoxLookupServiceContract {
  private readonly resolver: LookupResolver

  constructor () {
    this.resolver = new LookupResolver({
      networkPreset: (typeof window !== 'undefined' && location.hostname === 'localhost'
        ? 'local'
        : (process.env.BSV_NETWORK as 'local' | 'mainnet' | 'testnet') ?? 'mainnet')
    })
  }

  /**
   * Uses LookupResolver to find the remote host responsible for the given identity.
   */
  private async resolveHost (identityKey: string): Promise<string | null> {
    try {
      const result = await this.resolver.query({
        service: 'ls_messagebox',
        query: { identityKey }
      })

      if (
        result != null &&
        typeof result === 'object' &&
        'type' in result &&
        result.type === 'freeform' &&
        'hosts' in result &&
        Array.isArray((result as any).hosts)
      ) {
        const hosts = (result as any).hosts
        if (hosts.length > 0) {
          return String(hosts[0])
        }
      }

      console.warn(`[LOOKUP] No valid host found for ${identityKey}.`)
    } catch (error) {
      console.warn(`[LOOKUP] Failed to resolve host for ${identityKey}:`, error)
    }

    return null
  }

  async acknowledgeMessages (identityKey: string, messageIds: string[]): Promise<{ acknowledged: boolean } | null> {
    const host = await this.resolveHost(identityKey)
    if (host === null || host === '') return null

    try {
      const response = await fetch(`${host}/acknowledgeMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: identityKey
        },
        body: JSON.stringify({ messageIds })
      })

      const data = await response.json()
      if (data?.status === 'success') {
        return { acknowledged: true }
      }

      console.warn(`[OVERLAY] Acknowledgment request to ${host} failed with response:`, data)
    } catch (err) {
      console.warn('[OVERLAY] Remote acknowledgeMessage failed:', err)
    }

    return null
  }

  async listMessages (identityKey: string, messageBox: string): Promise<Message[] | null> {
    const host = await this.resolveHost(identityKey)
    if (host === null || host === '') return null

    try {
      const response = await fetch(`${host}/listMessages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: identityKey
        },
        body: JSON.stringify({ messageBox })
      })

      const data = await response.json()
      if (data?.status === 'success' && Array.isArray(data.messages)) {
        return data.messages
      }

      console.warn(`[OVERLAY] listMessages request to ${host} failed with response:`, data)
    } catch (error) {
      console.warn('[OVERLAY] Error while forwarding listMessages:', error)
    }

    return null
  }

  async forwardMessage (message: Message, sender: string): Promise<{ forwarded: boolean, host?: string } | null> {
    const host = await this.resolveHost(message.recipient)
    if (host === null || host === '') return null

    try {
      const response = await fetch(`${host}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: sender
        },
        body: JSON.stringify({ sender, message })
      })

      const data = await response.json()
      if (data?.status === 'success') {
        return { forwarded: true, host }
      }

      console.warn(`[OVERLAY] sendMessage request to ${host} failed with response:`, data)
    } catch (error) {
      console.warn('[OVERLAY] Error while forwarding sendMessage:', error)
    }

    return null
  }
}

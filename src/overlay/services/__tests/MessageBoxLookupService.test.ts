import { MessageBoxLookupService } from '../MessageBoxLookupService.js'
import type { Message } from '../../types.js'
import axios from 'axios'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

const mockStorage = {
  getLatestHostFor: jest.fn()
}

const createService = (): MessageBoxLookupService => new MessageBoxLookupService(mockStorage as any)

describe('MessageBoxLookupService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('acknowledgeMessages', () => {
    it('returns acknowledged true if overlay responds with success', async () => {
      mockStorage.getLatestHostFor.mockResolvedValueOnce('http://host')
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'success' } })

      const service = createService()
      const result = await service.acknowledgeMessages('recipientKey', ['m1', 'm2'])

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://host/acknowledgeMessage',
        { messageIds: ['m1', 'm2'] },
        expect.objectContaining({ headers: { Authorization: 'recipientKey' } })
      )
      expect(result).toEqual({ acknowledged: true })
    })

    it('returns null if no host is found', async () => {
      mockStorage.getLatestHostFor.mockResolvedValueOnce(null)

      const service = createService()
      const result = await service.acknowledgeMessages('key', ['m1'])

      expect(result).toBeNull()
    })

    it('returns null on error', async () => {
      mockStorage.getLatestHostFor.mockResolvedValueOnce('http://host')
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'))

      const service = createService()
      const result = await service.acknowledgeMessages('key', ['m1'])

      expect(result).toBeNull()
    })
  })

  describe('listMessages', () => {
    it('returns messages if overlay responds with success', async () => {
      const messages = [{
        messageId: 'm1',
        body: '{}',
        sender: 'a',
        recipient: 'b',
        messageBox: 'inbox'
      }]
      mockStorage.getLatestHostFor.mockResolvedValueOnce('http://host')
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'success', messages } })

      const service = createService()
      const result = await service.listMessages('recipientKey', 'inbox')

      expect(result).toEqual(messages)
    })

    it('returns null if no host found', async () => {
      mockStorage.getLatestHostFor.mockResolvedValueOnce(null)

      const service = createService()
      const result = await service.listMessages('key', 'inbox')

      expect(result).toBeNull()
    })

    it('returns null on bad response', async () => {
      mockStorage.getLatestHostFor.mockResolvedValueOnce('http://host')
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'error' } })

      const service = createService()
      const result = await service.listMessages('key', 'inbox')

      expect(result).toBeNull()
    })
  })

  describe('forwardMessage', () => {
    const message: Message = {
      messageId: 'm1',
      messageBox: 'payment_inbox',
      body: '{"foo":"bar"}',
      sender: 'senderKey',
      recipient: 'recipientKey'
    }

    it('returns forwarded true if overlay responds with success', async () => {
      mockStorage.getLatestHostFor.mockResolvedValueOnce('http://host')
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'success' } })

      const service = createService()
      const result = await service.forwardMessage(message, message.sender)

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://host/sendMessage',
        { message },
        expect.objectContaining({ headers: { Authorization: message.sender } })
      )
      expect(result).toEqual({ forwarded: true, host: 'http://host' })
    })

    it('returns null if no host found', async () => {
      mockStorage.getLatestHostFor.mockResolvedValueOnce(null)

      const service = createService()
      const result = await service.forwardMessage(message, message.sender)

      expect(result).toBeNull()
    })

    it('returns null on bad response', async () => {
      mockStorage.getLatestHostFor.mockResolvedValueOnce('http://host')
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'fail' } })

      const service = createService()
      const result = await service.forwardMessage(message, message.sender)

      expect(result).toBeNull()
    })
  })
})

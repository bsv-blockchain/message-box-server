import { MessageBoxLookupService } from '../../lookup-services/MessageBoxLookupService.js'
import { MessageBoxStorage } from '../services/MessageBoxStorage.js'
import { knex, getWallet } from '../../app.js'
import http from 'http'
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'

let identityKey: string
let testServer: http.Server
let receivedBody: any = null

const TEST_HOST = 'http://localhost:4567'

describe('MessageBoxLookupService (Integration)', () => {
  beforeAll(async () => {
    const wallet = await getWallet()
    identityKey = (await wallet.getPublicKey({ identityKey: true })).publicKey

    await knex('messagebox_advertisement').where({ identity_key: identityKey }).del()
    await knex('messagebox_advertisement').insert({
      identity_key: identityKey,
      host: TEST_HOST,
      timestamp: new Date(),
      nonce: 'test-nonce',
      signature: 'test-signature',
      txid: 'test-txid',
      created_at: new Date()
    })

    testServer = http.createServer((req, res) => {
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })

      req.on('end', () => {
        try {
          receivedBody = JSON.parse(body)
        } catch { }

        res.setHeader('Content-Type', 'application/json')

        if (req.url === '/sendMessage') {
          res.writeHead(200, { 'Content-Type': 'application/json' })

          // Confirm sender is included and preserve it
          receivedBody = {
            sender: receivedBody?.sender,
            message: receivedBody?.message
          }

          res.end(JSON.stringify({ status: 'success' }))
        } else if (req.url === '/listMessages') {
          res.writeHead(200)
          res.end(JSON.stringify({
            status: 'success',
            messages: [{ messageId: 'm1', body: 'hi', sender: 'senderKey' }]
          }))
        } else if (req.url === '/acknowledgeMessage') {
          res.writeHead(200)
          res.end(JSON.stringify({
            status: 'success',
            acknowledged: true
          }))
        } else {
          res.writeHead(404)
          res.end()
        }
      })
    })

    await new Promise<void>(resolve => testServer.listen(4567, resolve))
  })

  afterAll(async () => {
    await knex('messagebox_advertisement').where({ identity_key: identityKey }).del()

    await new Promise<void>((resolve, reject) => {
      testServer.close((err?: Error | null) => {
        if (err != null) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  })

  it('should forward a message using a recent advertisement', async () => {
    const service = new MessageBoxLookupService(new MessageBoxStorage(knex))

    const message = {
      recipient: identityKey,
      messageBox: 'testbox',
      messageId: 'test-msg-id',
      body: 'Integration test message',
      sender: 'mock-sender-key'
    }

    const result = await service.forwardMessage(message, 'mock-sender-key')

    expect(result).toMatchObject({
      forwarded: true,
      host: TEST_HOST
    })

    expect(receivedBody).toMatchObject({
      sender: 'mock-sender-key',
      message: {
        recipient: identityKey,
        messageBox: 'testbox',
        messageId: 'test-msg-id',
        body: 'Integration test message'
      }
    })
  })

  it('should list messages via overlay using recent advertisement', async () => {
    const service = new MessageBoxLookupService(new MessageBoxStorage(knex))
    const messages = await service.listMessages(identityKey, 'testbox')
    expect(Array.isArray(messages)).toBe(true)
    expect(messages?.[0]).toMatchObject({ messageId: 'm1', body: 'hi', sender: 'senderKey' })
  })

  it('should acknowledge messages via overlay using recent advertisement', async () => {
    const service = new MessageBoxLookupService(new MessageBoxStorage(knex))
    const result = await service.acknowledgeMessages(identityKey, ['msg-123', 'msg-456'])

    expect(receivedBody).toMatchObject({
      messageIds: ['msg-123', 'msg-456']
    })

    expect(result).toMatchObject({ acknowledged: true })
  })
})

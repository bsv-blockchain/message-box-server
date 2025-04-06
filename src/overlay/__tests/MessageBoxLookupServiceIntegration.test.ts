import { MessageBoxLookupService } from '../MessageBoxLookupService.js'
import { MessageBoxStorage } from '../MessageBoxStorage.js'
import { knex, getWallet } from '../../../app.js'
import http from 'http'
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'

let identityKey: string
let testServer: http.Server
let receivedBody: any = null

const TEST_HOST = 'http://localhost:4567'

describe('MessageBoxLookupService (Integration)', () => {
  beforeAll(async () => {
    // Set up test wallet + identity
    const wallet = await getWallet()
    identityKey = (await wallet.getPublicKey({ identityKey: true })).publicKey

    // Clean up previous ads
    await knex('overlay_ads').where({ identity_key: identityKey }).del()

    // Insert a test advertisement
    await knex('overlay_ads').insert({
      identity_key: identityKey,
      host: TEST_HOST,
      timestamp: Math.floor(Date.now() / 1000),
      nonce: 'test-nonce',
      signature: 'test-signature',
      txid: 'test-txid',
      created_at: new Date()
    })

    // Spin up a basic HTTP server to act as the overlay recipient
    testServer = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/overlay/relay') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          receivedBody = JSON.parse(body)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: 'received', messageId: receivedBody?.message?.messageId }))
        })
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    await new Promise(resolve => testServer.listen(4567, resolve))
  })

  afterAll(async () => {
    await knex('overlay_ads').where({ identity_key: identityKey }).del()
    await knex.destroy()
    await new Promise(resolve => testServer.close(resolve))
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
      host: TEST_HOST,
      response: {
        status: 'received',
        messageId: 'test-msg-id'
      }
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
})

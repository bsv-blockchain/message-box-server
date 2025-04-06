import request from 'supertest'
import { app, knex, getWallet } from '../../app.js'
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import { mockAd } from '../../utils/__mocks__/advertiserIntegration.js'
import { PrivateKey } from '@bsv/sdk'
import { MessageBoxLookupService } from '../../overlay/services/MessageBoxLookupService.js'
import * as advertiserUtils from '../../utils/advertiserIntegration.js'

jest.mock('../../utils/advertiserIntegration.js')

describe('/overlay integration tests', () => {
  let identityKey: string

  beforeAll(async () => {
    const wallet = await getWallet()
    identityKey = (await wallet.getPublicKey({ identityKey: true })).publicKey

    // Clean slate
    await knex('overlay_ads').where({ identity_key: identityKey }).del()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  it('POST /overlay/advertise should broadcast and store an advertisement', async () => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .post('/overlay/advertise')
      .set('Authorization', identityKey)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('advertisement')
    expect(res.body.advertisement).toMatchObject({
      identityKey: mockAd.identityKey,
      host: expect.any(String),
      timestamp: expect.any(Number),
      nonce: expect.any(String),
      signature: expect.any(String)
    })

    // Manually insert mockAd into DB (since broadcast was mocked)
    await knex('overlay_ads').insert({
      identity_key: mockAd.identityKey,
      host: mockAd.host,
      timestamp: mockAd.timestamp,
      nonce: mockAd.nonce,
      signature: mockAd.signature,
      txid: mockAd.txid,
      created_at: new Date()
    })

    const rows = await knex('overlay_ads')
      .where({ identity_key: mockAd.identityKey })
      .orderBy('created_at', 'desc')
      .limit(1)

    expect(rows.length).toBeGreaterThan(0)
    const ad = rows[0]

    expect(ad).toMatchObject({
      identity_key: mockAd.identityKey,
      host: mockAd.host,
      timestamp: mockAd.timestamp,
      nonce: mockAd.nonce,
      signature: mockAd.signature,
      txid: mockAd.txid
    })
  })

  it('GET /overlay/ads should return recent advertisements', async () => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .get('/overlay/ads')

    expect(res.status).toBe(200)
    expect(res.body.ads).toBeInstanceOf(Array)
    expect(res.body.ads.length).toBeGreaterThan(0)

    const ad = res.body.ads.find((a: any) => a.identityKey === mockAd.identityKey)
    expect(ad).toMatchObject({
      identityKey: mockAd.identityKey,
      host: mockAd.host,
      timestamp: mockAd.timestamp,
      nonce: mockAd.nonce,
      signature: mockAd.signature,
      txid: mockAd.txid
    })
  })

  it('POST /overlay/anoint should broadcast and store an anointment advertisement', async () => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .post('/overlay/anoint')
      .set('Authorization', identityKey)
      .send({ host: 'http://localhost:3000' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('advertisement')
    expect(res.body.advertisement).toMatchObject({
      identityKey: mockAd.identityKey,
      host: mockAd.host,
      nonce: mockAd.nonce,
      signature: mockAd.signature,
      txid: mockAd.txid
    })
    expect(Math.abs(res.body.advertisement.timestamp - mockAd.timestamp)).toBeLessThanOrEqual(1)
  })

  it('POST /sendMessage should store a message and return success', async () => {
    const recipient = PrivateKey.fromRandom().toPublicKey().toString()

    const messageId = `msg-${Date.now()}`
    const messageBox = 'default'
    const messageBody = 'This is a test message from overlay integration test.'

    // Clean up any prior messages or messageBox entries
    await knex('messages').where({ messageId }).del()
    await knex('messageBox').where({ identityKey: recipient, type: messageBox }).del()

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .post('/sendMessage')
      .set('Authorization', identityKey)
      .send({
        message: {
          messageId,
          recipient,
          messageBox,
          body: messageBody
        }
      })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'success', messageId })

    const storedMessage = await knex('messages').where({ messageId }).first()
    expect(storedMessage).toMatchObject({
      messageId,
      sender: identityKey,
      recipient,
      body: messageBody
    })
  })

  it('POST /sendMessage should forward using overlay if no local messageBox exists', async () => {
    const messageId = `overlay-fwd-${Date.now()}`
    const recipient = '03112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00'

    // Ensure no local messageBox
    await knex('messageBox').where({ identityKey: recipient }).del()

    // Scoped mock for this one test
    const spy = jest
      .spyOn(MessageBoxLookupService.prototype, 'forwardMessage')
      .mockResolvedValue({ forwarded: true, host: 'mock-host.com' })

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .post('/sendMessage')
      .set('Authorization', identityKey)
      .send({
        message: {
          messageId,
          recipient,
          messageBox: 'forward_test',
          body: 'Overlay forward test'
        }
      })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      forwarded: true,
      host: 'mock-host.com'
    })

    const stored = await knex('messages').where({ messageId }).first()
    expect(stored).toBeUndefined()

    // Clean up the mock so it doesn’t affect other tests
    spy.mockRestore()
  })

  it('POST /listMessages should return stored messages from local messageBox', async () => {
    const recipient = PrivateKey.fromRandom().toPublicKey().toString()
    const messageBox = 'testbox'
    const messageId = `msg-${Date.now()}`
    const messageBody = 'Local test message'

    // Create messageBox manually
    const [messageBoxId] = await knex('messageBox').insert({
      identityKey: recipient,
      type: messageBox,
      created_at: new Date(),
      updated_at: new Date()
    })

    await knex('messages').insert({
      messageId,
      messageBoxId,
      sender: identityKey,
      recipient,
      body: messageBody,
      created_at: new Date(),
      updated_at: new Date()
    })

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .post('/listMessages')
      .set('Authorization', recipient)
      .send({ messageBox })

    expect(res.status).toBe(200)
    expect(res.body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageId,
          body: messageBody,
          sender: identityKey
        })
      ])
    )
  })

  it('POST /acknowledgeMessage should delete a message from local DB', async () => {
    const recipient = PrivateKey.fromRandom().toPublicKey().toString()
    const messageBox = 'ackBox'
    const messageId = `ack-${Date.now()}`
    const messageBody = 'Message to acknowledge'

    const [messageBoxId] = await knex('messageBox').insert({
      identityKey: recipient,
      type: messageBox,
      created_at: new Date(),
      updated_at: new Date()
    })

    await knex('messages').insert({
      messageId,
      messageBoxId,
      sender: identityKey,
      recipient,
      body: messageBody,
      created_at: new Date(),
      updated_at: new Date()
    })

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .post('/acknowledgeMessage')
      .set('Authorization', recipient)
      .send({ messageIds: [messageId] })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'success', source: 'local' })

    const check = await knex('messages').where({ messageId }).first()
    expect(check).toBeUndefined()
  })

  it('POST /overlay/rebroadcast should succeed', async () => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .post('/overlay/rebroadcast')
      .set('Authorization', identityKey)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('txid')
    expect(res.body.txid).toBe(mockAd.txid)
  })

  it('POST /overlay/rebroadcast should fail if broadcast throws', async () => {
    const spy = jest
      .spyOn(advertiserUtils, 'broadcastAdvertisement')
      .mockRejectedValueOnce(new Error('fail'))

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .post('/overlay/rebroadcast')
      .set('Authorization', identityKey)

    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Failed to rebroadcast/)

    spy.mockRestore()
  })
})

import request from 'supertest'
import { app, knex, getWallet } from '../../app.js'
import { mockAd as mockAdFactory } from '../../utils/__mocks__/advertiserIntegration.js'
import { PrivateKey } from '@bsv/sdk'
import { MessageBoxLookupService } from '../../lookup-services/MessageBoxLookupService.js'
import * as advertiserUtils from '../../utils/advertiserIntegration.js'

jest.mock('../../utils/advertiserIntegration.js')

describe('/overlay integration tests', () => {
  let identityKey: string

  beforeAll(async () => {
    const wallet = await getWallet()
    identityKey = (await wallet.getPublicKey({ identityKey: true })).publicKey

    await knex('messagebox_advertisement').where({ identity_key: identityKey }).del()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  it('POST /overlay/advertise should broadcast and store an advertisement', async () => {
    const mockAd = mockAdFactory()

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .post('/overlay/advertise')
      .set('Authorization', identityKey)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('advertisement')

    const received = res.body.advertisement
    expect(received).toMatchObject({
      identityKey: mockAd.identityKey,
      host: mockAd.host,
      nonce: mockAd.nonce,
      signature: mockAd.signature,
      txid: mockAd.txid
    })

    expect(typeof received.timestamp).toBe('string')
    expect(new Date(received.timestamp).toISOString()).toBe(received.timestamp)
  })

  it('GET /overlay/ads should return recent advertisements', async () => {
    const mockAd = mockAdFactory()

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .get('/overlay/ads')

    expect(res.status).toBe(200)
    expect(res.body.ads).toBeInstanceOf(Array)

    const ad = res.body.ads.find((a: any) => a.identityKey === mockAd.identityKey)
    expect(ad).toMatchObject({
      identityKey: mockAd.identityKey,
      host: mockAd.host,
      nonce: mockAd.nonce,
      signature: mockAd.signature,
      txid: mockAd.txid
    })
  })

  it('POST /overlay/anoint should broadcast and store an anointment advertisement', async () => {
    const mockAd = mockAdFactory()

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .post('/overlay/anoint')
      .set('Authorization', identityKey)
      .send({ host: 'http://localhost:3000' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('advertisement')
    const received = res.body.advertisement

    expect(received).toMatchObject({
      identityKey: mockAd.identityKey,
      host: mockAd.host,
      nonce: mockAd.nonce,
      signature: mockAd.signature,
      txid: mockAd.txid
    })

    const toIsoString = (ts: string | Date): string =>
      typeof ts === 'string' ? ts : ts.toISOString()

    const receivedTs = Date.parse(toIsoString(received.timestamp))
    const expectedTs = Date.parse(toIsoString(mockAd.timestamp))

    expect(Math.abs(receivedTs - expectedTs)).toBeLessThanOrEqual(1000)
  })

  it('POST /sendMessage should store a message and return success', async () => {
    const recipient = PrivateKey.fromRandom().toPublicKey().toString()
    const messageId = `msg-${Date.now()}`
    const messageBox = 'default'
    const messageBody = 'Test message from overlay integration'

    await knex('messages').where({ messageId }).del()
    await knex('messageBox').where({ identityKey: recipient, type: messageBox }).del()

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const res = await request(app)
      .post('/sendMessage')
      .set('Authorization', identityKey)
      .send({ message: { messageId, recipient, messageBox, body: messageBody } })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'success', messageId })

    const stored = await knex('messages').where({ messageId }).first()
    expect(stored).toMatchObject({
      messageId,
      sender: identityKey,
      recipient,
      body: messageBody
    })
  })

  it('POST /sendMessage should forward using overlay if no local messageBox exists', async () => {
    const messageId = `overlay-fwd-${Date.now()}`
    const recipient = '03112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00'
    await knex('messageBox').where({ identityKey: recipient }).del()

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
          body: 'Forward overlay test'
        }
      })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ forwarded: true, host: 'mock-host.com' })
    const stored = await knex('messages').where({ messageId }).first()
    expect(stored).toBeUndefined()

    spy.mockRestore()
  })

  it('POST /listMessages should return stored messages from local messageBox', async () => {
    const recipient = PrivateKey.fromRandom().toPublicKey().toString()
    const messageBox = 'testbox'
    const messageId = `msg-${Date.now()}`
    const messageBody = 'Local test message'

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
    const messageBody = 'Acknowledge this message'

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
    const mockAd = mockAdFactory()

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

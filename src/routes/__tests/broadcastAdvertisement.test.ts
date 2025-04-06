import { broadcastAdvertisement } from '../../utils/advertiserIntegration.js'
import { getWallet, knex } from '../../app.js'

describe('broadcastAdvertisement (real)', () => {
  let identityKey: string

  beforeAll(async () => {
    const wallet = await getWallet()
    identityKey = (await wallet.getPublicKey({ identityKey: true })).publicKey
    await knex('overlay_ads').where({ identity_key: identityKey }).del()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  it('should broadcast and store an advertisement using real SHIP code', async () => {
    const result = await broadcastAdvertisement({
      host: 'http://localhost:3000',
      identityKey,
      wallet: await getWallet()
    })

    expect(result).toHaveProperty('advertisement')
    expect(result.txid).toMatch(/^[a-f0-9]{64}$/)

    const ad = result.advertisement
    expect(ad).toMatchObject({
      identityKey,
      host: 'http://localhost:3000',
      timestamp: expect.any(Number),
      nonce: expect.any(String),
      signature: expect.any(String)
    })

    const rows = await knex('overlay_ads')
      .where({ identity_key: identityKey })
      .orderBy('created_at', 'desc')
      .limit(1)

    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].txid).toBe(result.txid)
  })
})

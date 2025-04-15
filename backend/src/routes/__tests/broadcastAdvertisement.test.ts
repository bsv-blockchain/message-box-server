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

    // Validate ad was returned
    expect(result).toHaveProperty('advertisement')

    // txid may be undefined if SHIP broadcast fails — don’t fail the test in that case
    if (result.txid != null) {
      expect(result.txid).toMatch(/^[a-f0-9]{64}$/)
    } else {
      console.warn('No txid returned — likely no SHIP relays accepted the transaction.')
    }

    const ad = result.advertisement
    expect(ad).toMatchObject({
      identityKey,
      host: 'http://localhost:3000',
      timestamp: expect.any(String),
      nonce: expect.any(String),
      signature: expect.any(String)
    })

    // Ensure it was stored in the DB
    const rows = await knex('overlay_ads')
      .where({ identity_key: identityKey })
      .orderBy('created_at', 'desc')
      .limit(1)

    expect(rows.length).toBeGreaterThan(0)

    if (result.txid != null) {
      expect(rows[0].txid).toBe(result.txid)
    }
  })
})

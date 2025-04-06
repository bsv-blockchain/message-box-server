/* eslint-env jest */
import { createAdvertisement } from '../../utils/advertiser.js'
import { createAdvertisementTx } from '../../utils/advertiserIntegration.js'
import {
  WalletInterface,
  createNonce,
  PrivateKey
} from '@bsv/sdk'
import request from 'supertest'
import express from 'express'
import { app as messageBoxApp, appReady, getWallet } from '../../app.js'

const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY ?? ''
if (SERVER_PRIVATE_KEY === '') throw new Error('SERVER_PRIVATE_KEY must be set in test env')

const privKey = PrivateKey.fromString(SERVER_PRIVATE_KEY)
const identityKey = privKey.toPublicKey().toString()

const testHost = 'https://relay.testhost.com'

// Helper to generate production-like auth headers using WalletInterface + SDK
async function generateAuthHeaders (wallet: WalletInterface): Promise<Record<string, string>> {
    const { publicKey } = await wallet.getPublicKey({ identityKey: true })
    const nonce = await createNonce(wallet)
  
    const signatureResult = await wallet.createSignature({
      data: Array.from(new TextEncoder().encode(nonce)),
      protocolID: [0, 'messageboxauth'],
      keyID: 'authn', // ✅ THIS IS THE FIX
      counterparty: 'anyone'
    })
  
    const signatureHex = signatureResult.signature
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  
    return {
      'x-bsv-auth-identity-key': publicKey,
      'x-bsv-auth-nonce': nonce,
      'x-bsv-auth-signature': signatureHex
    }
  }
  

describe('Overlay Integration (MessageBox Server)', () => {
  let app: express.Express
  let wallet: WalletInterface

  beforeAll(async () => {
    await appReady
    app = messageBoxApp
    wallet = await getWallet()
  })

  afterAll(async () => {
    const { knex } = await import('../../app.js')
    await knex.destroy()
  })

  it('should accept a signed advertisement and store it', async () => {
    const advertisement = await createAdvertisement({
      host: testHost,
      identityKey,
      wallet
    })

    const adTx = createAdvertisementTx(advertisement)
    const adTxHex = adTx.toHex()
    const authHeaders = await generateAuthHeaders(wallet)

    const response = await request(app)
      .post('/overlay/advertise')
      .set('Content-Type', 'application/json')
      .set(authHeaders)
      .send({ identityKey, host: testHost, tx: adTxHex })

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('success')
  })

  it('should retrieve the advertisement via /overlay/ads', async () => {
    const authHeaders = await generateAuthHeaders(wallet)

    const adsResponse = await request(app)
      .get('/overlay/ads')
      .set(authHeaders)

    expect(adsResponse.status).toBe(200)
    expect(Array.isArray(adsResponse.body.ads)).toBe(true)

    const matching = adsResponse.body.ads.find((ad: any) => ad.identity_key === identityKey)
    expect(matching).toBeDefined()
    expect(matching.host).toBe(testHost)
  })
})

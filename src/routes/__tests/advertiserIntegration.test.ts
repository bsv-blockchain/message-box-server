import http from 'http'
import { TextEncoder } from 'util'
import {
  broadcastAdvertisement
} from '../../utils/advertiserIntegration.js'
import {
  TopicBroadcaster,
  HTTPSOverlayBroadcastFacilitator,
  LookupResolver,
  PrivateKey
} from '@bsv/sdk'
import type { WalletInterface } from '@bsv/sdk'

// Generate a real random private key and derive its public key
const randomPrivateKey = PrivateKey.fromRandom()
const validPrivateKey = randomPrivateKey.toString('hex')
const validPublicKey = randomPrivateKey.toPublicKey().toString()

// Build a minimal wallet using real keys so that createNonce works
const realWallet: WalletInterface = {
  createHmac: async () => {
    return { hmac: PrivateKey.fromRandom().toString('hex') }
  },
  getPublicKey: async () => validPublicKey,
  revealCounterpartyKeyLinkage: async () => {},
  revealSpecificKeyLinkage: async () => {},
  encrypt: async (data: any) => data,
  decrypt: async (data: any) => data,
  sign: async (data: any) => randomPrivateKey.sign(data).toString()
} as unknown as WalletInterface

let server: http.Server
let port: number
let localServerUrl: string
let capturedRequestBody: string | null = null

function startLocalServer (
  onRequest: (req: http.IncomingMessage, res: http.ServerResponse) => void
) {
  return new Promise<void>(resolve => {
    server = http.createServer((req, res) => {
      onRequest(req, res)
    })
    server.listen(0, () => {
      port = (server.address() as any).port
      localServerUrl = `http://localhost:${port}`
      resolve()
    })
  })
}

function createCustomBroadcaster (topics: string[]): TopicBroadcaster {
    const facilitator = new HTTPSOverlayBroadcastFacilitator(fetch, true)
  
    // Force override send to always go to local test server
    const originalSend = facilitator.send
    facilitator.send = async (_url, taggedBEEF) => {
      console.log('[TEST] facilitator.send sending to local server')
      return originalSend.call(facilitator, localServerUrl, taggedBEEF)
    }
  
    // Force all hosts to be treated as interested (skip protocol filters)
    (facilitator as any).shouldBroadcastToHost = () => true
  
    const resolver = new LookupResolver({ networkPreset: 'local' })
    resolver.query = async () => ({
      type: 'output-list',
      outputs: [
        {
          beef: [],
          outputIndex: 0,
          domain: localServerUrl
        }
      ]
    })
  
    return new TopicBroadcaster(topics, { facilitator, resolver })
  }
  
describe('Integration: advertiserIntegration using real keys', () => {
  beforeEach(async () => {
    capturedRequestBody = null
    await startLocalServer((req, res) => {
      if (req.method === 'POST' && req.url === '/submit') {
        let body = ''
        req.on('data', chunk => {
          body += chunk
        })
        req.on('end', () => {
          capturedRequestBody = body
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              status: 'success',
              txid: 'localTxId',
              message: 'Sent to local overlay host'
            })
          )
        })
      } else {
        res.writeHead(404)
        res.end()
      }
    })
  })

  afterEach(done => {
    server.close(() => done())
  })

  it('should broadcast advertisement successfully', async () => {
    const params = {
      host: 'https://example.com',
      identityKey: validPublicKey,
      privateKey: validPrivateKey,
      wallet: realWallet,
      topics: ['tm_messagebox_ad']
    }

    const broadcaster = createCustomBroadcaster(params.topics)
    const result = await broadcastAdvertisement({ ...params, broadcaster })

    expect(result.status).toBe('success')
    expect(result.txid).toBe('localTxId')
  })

  it('should capture full content of transmitted advertisement', async () => {
    const params = {
      host: 'https://example.com',
      identityKey: validPublicKey,
      privateKey: validPrivateKey,
      wallet: realWallet,
      topics: ['tm_messagebox_ad']
    }

    const broadcaster = createCustomBroadcaster(params.topics)
    const result = await broadcastAdvertisement({ ...params, broadcaster })

    expect(result.status).toBe('success')
    expect(result.requestBody).toBeTruthy()

    const parsed = JSON.parse(result.requestBody as string)
    expect(parsed.protocol).toBe('MB_AD')
    expect(parsed.version).toBe('1.0')
    expect(parsed.identityKey).toBe(params.identityKey)
    expect(parsed.host).toBe(params.host)
    expect(parsed.nonce).toBeTruthy()
    expect(parsed.signature).toBeTruthy()
  })

  it('should simulate a network timeout by closing the server', async () => {
    const params = {
      host: 'https://example.com',
      identityKey: validPublicKey,
      privateKey: validPrivateKey,
      wallet: realWallet,
      topics: ['tm_messagebox_ad']
    }

    await new Promise<void>(resolve => {
      server.close(() => resolve())
    })

    const broadcaster = createCustomBroadcaster(params.topics)
    const result = await broadcastAdvertisement({ ...params, broadcaster })

    expect(result.status).toBe('error')
    expect(result.code).toBeTruthy()
    expect(result.description).toBeTruthy()
  })
})

import request from 'supertest'
import { http } from '../../index.js'

describe('MessageBox API Integration - sendMessage', () => {
  it('should send a message successfully', async () => {
    const res = await request(http)
      .post('/sendMessage')
      .send({
        message: {
          recipient: '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1',
          messageBox: 'testBox',
          messageId: 'test123',
          body: 'Hello, integration test!'
        }
      })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
  })
})

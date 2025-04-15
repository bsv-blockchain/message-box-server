// src/overlay/services/configureWebSocketRoutes.ts
import { AuthSocketServer } from '@bsv/authsocket'
import { Logger } from '../../utils/logger.js'
import { PublicKey } from '@bsv/sdk'
import { knex } from '../../app.js'

export default async function configureWebSocketRoutes ({
  httpServer,
  wallet
}: {
  httpServer: any
  wallet: any
}): Promise<void> {
  Logger.log('[WEBSOCKET] Setting up WebSocket support (LARS deployment)')

  const io = new AuthSocketServer(httpServer, {
    wallet,
    cors: { origin: '*', methods: ['GET', 'POST'] }
  })

  const authenticatedSockets = new Map<string, string>()

  io.on('connection', (socket) => {
    Logger.log('[WEBSOCKET] New connection established.')

    if (typeof socket.identityKey === 'string' && socket.identityKey.trim() !== '') {
      try {
        const parsedIdentityKey = PublicKey.fromString(socket.identityKey)
        authenticatedSockets.set(socket.id, parsedIdentityKey.toString())
        void socket.emit('authenticationSuccess', { status: 'success' })
      } catch (error) {
        Logger.error('[WEBSOCKET ERROR] Failed to parse identity key on connection:', error)
      }
    } else {
      socket.on('authenticated', (data) => {
        void (async () => {
          try {
            const parsedKey = PublicKey.fromString(data.identityKey)
            authenticatedSockets.set(socket.id, parsedKey.toString())
            await socket.emit('authenticationSuccess', { status: 'success' })
          } catch (error) {
            await socket.emit('authenticationFailed', { reason: 'Invalid identity key' })
          }
        })()
      })
    }

    // Re-adding Send Message Handling
    socket.on('sendMessage', (data: { roomId: string, message: { messageId: string, recipient: string, body: string } }) => {
      void (async () => {
        if (typeof data !== 'object' || data == null) {
          Logger.error('[WEBSOCKET ERROR] Invalid data object received.')
          await socket.emit('messageFailed', { reason: 'Invalid data object' })
          return
        }

        const { roomId, message } = data

        if (!authenticatedSockets.has(socket.id)) {
          Logger.warn('[WEBSOCKET] Unauthorized attempt to send a message.')
          await socket.emit('paymentFailed', { reason: 'Unauthorized: WebSocket not authenticated' })
          return
        }

        Logger.log(`[WEBSOCKET] Processing sendMessage for room: ${roomId}`)

        try {
          if (typeof roomId !== 'string' || roomId.trim() === '') {
            Logger.error('[WEBSOCKET ERROR] Invalid roomId:', roomId)
            await socket.emit('messageFailed', { reason: 'Invalid room ID' })
            return
          }

          if (typeof message !== 'object' || message == null) {
            Logger.error('[WEBSOCKET ERROR] Invalid message object:', message)
            await socket.emit('messageFailed', { reason: 'Invalid message object' })
            return
          }

          if (typeof message.body !== 'string' || message.body.trim() === '') {
            Logger.error('[WEBSOCKET ERROR] Invalid message body:', message.body)
            await socket.emit('messageFailed', { reason: 'Invalid message body' })
            return
          }

          Logger.log(`[WEBSOCKET] Acknowledging message ${message.messageId} to sender.`)

          const ackPayload = {
            status: 'success',
            messageId: message.messageId
          }

          Logger.log(`[WEBSOCKET] Emitting ack event: sendMessageAck-${roomId}`)

          socket.emit(`sendMessageAck-${roomId}`, ackPayload).catch((error) => {
            Logger.error(`[WEBSOCKET ERROR] Failed to emit sendMessageAck-${roomId}:`, error)
          })

          try {
            const parts = roomId.split('-')
            const messageBoxType = parts.length > 1 ? parts[1] : 'default'

            Logger.log(`[WEBSOCKET] Parsed messageBoxType: ${messageBoxType}`)
            Logger.log(`[WEBSOCKET] Attempting to store message for recipient: ${message.recipient}, box type: ${messageBoxType}`)

            let messageBox = await knex('messageBox')
              .where({ identityKey: message.recipient, type: messageBoxType })
              .first()

            if (messageBox === null || messageBox === undefined) {
              Logger.log('[WEBSOCKET] messageBox not found. Creating new messageBox.')
              await knex('messageBox').insert({
                identityKey: message.recipient,
                type: messageBoxType,
                created_at: new Date(),
                updated_at: new Date()
              })
            }

            messageBox = await knex('messageBox')
              .where({ identityKey: message.recipient, type: messageBoxType })
              .select('messageBoxId')
              .first()

            const messageBoxId = messageBox?.messageBoxId ?? null

            if (messageBoxId === null || messageBoxId === undefined) {
              Logger.warn('[WEBSOCKET WARNING] messageBoxId is null — message may not be stored correctly!')
            } else {
              Logger.log(`[WEBSOCKET] Resolved messageBoxId: ${String(messageBoxId)}`)
            }

            const senderKey = authenticatedSockets.get(socket.id) ?? null

            const insertResult = await knex('messages')
              .insert({
                messageId: message.messageId,
                messageBoxId,
                sender: senderKey,
                recipient: message.recipient,
                body: message.body,
                created_at: new Date(),
                updated_at: new Date()
              })
              .onConflict('messageId')
              .ignore()

            if (insertResult.length === 0) {
              Logger.warn('[WEBSOCKET WARNING] Message insert was ignored due to conflict (duplicate messageId?)')
            } else {
              Logger.log('[WEBSOCKET] Message successfully stored in DB.')
            }
          } catch (dbError) {
            Logger.error('[WEBSOCKET ERROR] Failed to store message in DB:', dbError)
            await socket.emit('messageFailed', { reason: 'Failed to store message' })
            return
          }

          if (io != null) {
            Logger.log(`[WEBSOCKET] Emitting message to room ${roomId}`)
            io.emit(`sendMessage-${roomId}`, {
              sender: authenticatedSockets.get(socket.id),
              messageId: message.messageId,
              body: message.body
            })
          } else {
            Logger.error('[WEBSOCKET ERROR] io is null, cannot emit message.')
          }
        } catch (error) {
          Logger.error('[WEBSOCKET ERROR] Unexpected failure in sendMessage handler:', error)
          await socket.emit('messageFailed', { reason: 'Unexpected error occurred' })
        }
      })()
    })

    // Re-adding Join Room Handling
    socket.on('joinRoom', (roomId: string) => {
      void (async () => {
        if (!authenticatedSockets.has(socket.id)) {
          Logger.warn('[WEBSOCKET] Unauthorized attempt to join a room.')
          await socket.emit('joinFailed', { reason: 'Unauthorized: WebSocket not authenticated' })
          return
        }

        if (roomId == null || typeof roomId !== 'string' || roomId.trim() === '') {
          Logger.error('[WEBSOCKET ERROR] Invalid roomId:', roomId)
          await socket.emit('joinFailed', { reason: 'Invalid room ID' })
          return
        }

        Logger.log(`[WEBSOCKET] User ${socket.id} joined room ${roomId}`)
        await socket.emit('joinedRoom', { roomId })
      })()
    })

    socket.on('leaveRoom', (roomId: string) => {
      void (async () => {
        if (!authenticatedSockets.has(socket.id)) {
          Logger.warn('[WEBSOCKET] Unauthorized attempt to leave a room.')
          await socket.emit('leaveFailed', { reason: 'Unauthorized: WebSocket not authenticated' })
          return
        }

        if (roomId == null || roomId === '' || typeof roomId !== 'string' || roomId.trim() === '') {
          Logger.error('[WEBSOCKET ERROR] Invalid roomId:', roomId)
          await socket.emit('leaveFailed', { reason: 'Invalid room ID' })
          return
        }

        Logger.log(`[WEBSOCKET] User ${socket.id} left room ${roomId}`)
        await socket.emit('leftRoom', { roomId })
      })()
    })

    socket.on('disconnect', (reason: string) => {
      Logger.log(`[WEBSOCKET] Disconnected: ${reason}`)
      authenticatedSockets.delete(socket.id)
    })
  })
}

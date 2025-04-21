# Message Box Server

A secure, peer-to-peer message routing server designed for the Bitcoin SV ecosystem. Supports both HTTP and WebSocket message transport, encrypted payloads, identity-based routing, and overlay advertisement via SHIP.

## Overview

MessageBox is a peer-to-peer messaging API that enables secure, encrypted, and authenticated communication between users on the MetaNet. This is primarily achieved through a message-box architecture combined with optional overlay routing and real-time WebSocket transport.

When a user sends a message, they must specify the messageBox type and the intended recipient (an identity key). This design allows for protocol-specific messageBox types to be defined at higher application layers, while maintaining clear separation of messages by type and recipient. Each message is routed into a box associated with a specific recipient and use case.

Security is a critical aspect of MessageBox. It relies on [Authrite middleware](https://github.com/p2ppsr/authrite-express) to ensure that only the recipient can access and acknowledge their own messages. In addition, encrypted payloads are supported using authenticated asymmetric key exchange with symmetric encryption, allowing messages to be securely transmitted and decrypted by the recipient.

MessageBox also supports [@bsv/authsocket](https://www.npmjs.com/package/@bsv/authsocket) for real-time authenticated WebSocket communication. This enables clients to receive messages instantly and interact with rooms associated with their identity key and chosen messageBox.

For more flexible routing, MessageBox integrates with the [@bsv/overlay](https://www.npmjs.com/package/@bsv/overlay) protocol, enabling public advertisement of MessageBox hosts via SHIP broadcasts. Clients can query these advertisements to route messages to remote servers if a direct messageBox is not available.

To interact with MessageBox, use [MessageBoxClient](https://github.com/bitcoin-sv/p2p), the client-side library designed to handle authentication, encryption, WebSocket communication, and overlay resolution.

For more information on the concepts behind PeerServ, check out the documentation on [Project Babbage](https://www.projectbabbage.com/docs/peerserv/concepts).

## Concepts
- **Identity Key:** All messages are addressed to an identity key (a public key)
- **MessageBox:** A named message stream associated with an identity key (e.g., payment_inbox)
- **Encrypted Payloads:** Messages can be AES-encrypted and include metadata
- **Overlay Routing:** MessageBox instances can advertise availability via the SHIP overlay protocol
- **Live Messaging:** Clients can join WebSocket rooms and receive messages in real-time
- **Acknowledgment:** Messages must be acknowledged to be removed from the database
________________________________________


## API Routes

### POST `/sendMessage`

Sends a message to a specific recipient's message box.

**Parameters:**
```json
{
  "message": {
    "recipient": "IDENTITY_PUBLIC_KEY",
    "messageBox": "payment_inbox",
    "messageId": "abc123",
    "body": "{...}" // Stringified JSON, optionally encrypted
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Your message has been sent to IDENTITY_PUBLIC_KEY"
}
```

### POST /listMessages
List all messages for the authenticated user from a specific messageBox.

**Parameters:**
```json
{
  "messageBox": "payment_inbox"
}
```

**Response:**
```json
{
  "status": "success",
  "messages": [
    {
      "messageId": "abc123",
      "body": "{...}",
      "sender": "SENDER_PUBLIC_KEY"
    }
  ]
}
```
________________________________________
### POST /acknowledgeMessage

Acknowledge (and delete) one or more messages after processing.

**Parameters:**
```json
{
  "messageIds": ["abc123", "def456"]
}
```

**Response:**
```json
{
  "status": "success"
}
```
________________________________________
## WebSocket Support
Clients can connect to MessageBox via WebSocket for live messaging:
- **Authentication** is performed via authenticated event or initial handshake.
- **Rooms** use the format: IDENTITYKEY-messageBoxName
- Events:
  - joinRoom → subscribe to a room
  - sendMessage → send a message
  - sendMessageAck-ROOM → receive acknowledgment
  - sendMessage-ROOM → receive broadcasted message
  - leaveRoom → leave a room

**Example WebSocket Usage:**
```ts
socket.emit('authenticated', { identityKey })
socket.emit('joinRoom', '028d...-payment_inbox')
socket.emit('sendMessage', {
  roomId: '028d...-payment_inbox',
  message: {
    messageId: 'abc123',
    recipient: '028d...',
    body: '{...}'
  }
})
```
________________________________________
## Overlay Integration
MessageBox participates in the SHIP overlay network by:
- **Broadcasting advertisements** mapping identity keys to reachable hosts
- **Verifying incoming advertisements** using [@bsv/overlay](https://www.npmjs.com/package/@bsv/overlay)
- **Responding to SHIP queries** via a LookupService

This allows clients to route messages to other MessageBox servers if the recipient is remote.
________________________________________
### Authentication
All routes require the Authorization header containing the user's public key (identityKey).
WebSocket connections also require authentication using the [@bsv/authsocket](https://www.npmjs.com/package/@bsv/authsocket) protocol.
________________________________________
### Environment Variables
**Variables**

NODE_ENV - Set to development, staging, or production

PORT - Port for the HTTP server (default: 8080 or 3000)

SERVER_PRIVATE_KEY - 256-bit hex private key used for signing/auth

WALLET_STORAGE_URL - URL of wallet-storage service for identity handling

ENABLE_WEBSOCKETS	- Set to 'true' to enable WebSocket transport

LOGGING_ENABLED	- Enable verbose logs for debugging
________________________________________
### Scripts
```bash
npm run dev      # Start with hot reloading
npm run start    # Start in production
npm run test     # Run all tests
npm run build    # Compile documentation
```
________________________________________
### Spinning Up (Local Dev)
1.	Clone the repo
2.	Install dependencies: npm install
3.	Set up .env with:
```env
SERVER_PRIVATE_KEY=...
WALLET_STORAGE_URL=http://localhost:3001
ENABLE_WEBSOCKETS=true
```
4.	Run the database: docker compose up -d
5.	Start server: npm run dev

Default ports:

MessageBox Server	8080

MySQL Database	3001

PHPMyAdmin	3003
________________________________________

### Example Message Payload (Encrypted)
```json
{
  "encrypted": true,
  "algorithm": "curvepoint-aes",
  "senderPublicKey": "02abc...",
  "encryptedSymmetricKey": [ ... ],
  "encryptedMessage": [ ... ]
}
```
________________________________________
### Deploying
See DEPLOYING.md for tips on deploying to Google Cloud, LARS, or Docker.
________________________________________
### License
This project is released under the Open BSV License.


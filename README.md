# PeerServ
Facilitates general secure peer-to-peer message exchanges between parties.

## Overview

PeerServ is a peer-to-peer messaging API that enables secure and authenticated communication between users on the MetaNet. This is primarily achieved through the use of a message-box architecture.

When a user sends a message, they must specify the messageBox type and the recipient. This design allows for standard messageBox protocols to be defined at a higher layer while creating a separation of messages based on their type and recipient. Once a user sends a message, it is placed in a messageBox specifically designated for that user and that protocol.

Security is a critical aspect of PeerServ. It relies on [Authrite middleware](https://github.com/p2ppsr/authrite-express) to ensure that only the user who created the messageBox can access its contents. Additionally, PeerServ is compatible with [PacketPay](https://github.com/p2ppsr/packetpay-express), which wraps the Authrite middleware and provides a way for PeerServ instance owners to monetize their services through API requests.

To make full use of PeerServ, you can use [Tokenator](https://github.com/p2ppsr/tokenator) which is the base-level client-side software for interacting with PeerServ.

For more information on the concepts behind PeerServ, check out the documentation on [Project Babbage](https://www.projectbabbage.com/docs/peerserv/concepts).

## API Routes

### POST `/sendMessage`

Sends a message to a specific recipient's message box.

Note: All parameters given in an object.
- **Parameters:**
  - **recipient**: The recipient's public key
  - **messageBox**: The name of the recipient's message box
  - **body**: The content of the message
- **Example Response:** `{ "status": "success" }`

### POST `/listMessages`

List all messages in a specific message box.

**Parameters:**
- **messageBox**: The name of the message box to list messages from
- **Example Response**: 
```json
{ 
  "status": "success", 
  "messages": [ {
    "messageId": 3301, 
    "body": '{
      "subject":"This is a test!",
      "messageBody":"Do you see the L?",
      "anyRandomData":"Yes, it works!"
    }',
    "sender": "028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1" 
  } ]
}
```

### POST `/acknowledgeMessage`

Acknowledges that a message has been received, processed, and can now be deleted from the server.

**Parameters:**
- **messageIds**: Array of message IDs to acknowledge
- **Example Response**: `{ "status": "success" }`

## Environmental Variables

You can pass `ENV=prod`, `ENV=staging` or `ENV=dev` depending the enviornment.

The following can also be configured:
- `SERVER_PRIVATE_KEY` - the server's private key for authentication
- `MIGRATE_KEY` - the key used to run the latest migration
- `HOSTING_DOMAIN` - the server's hosting domain

## Scripts

- `build` — build the API documentation
- `start` — start the server without any debugging services
- `dev` — start the server with debugging capabilities
- `test` — run all available tests

## Spinning Up

Clone the repo with Docker installed.

Generate a `SERVER_PRIVATE_KEY` (64 random hex digits, 256-bits) and put it into the `docker-compose.yml` file. This is the key that will be used by authrite for mutual authentication.

Run `docker compose up`
- Your API will run on port **3002**
- Your database will be available on port **3001**
  - Username: `root`
  - Password: `test`
  - Database: `peerserv`
- A web SQL database viewer (PHPMyAdmin) is on port **3003**

To interact with this API, spin up a copy of the [PeerPay Simple UI](https://github.com/p2ppsr/peerpay-simple-ui) demo in parallel with this system.

## Deploying

You can see some brief guidance on [deploying this server with Google Cloud Run](DEPLOYING.md).

## License

The license for the code in this repository is the Open BSV License.

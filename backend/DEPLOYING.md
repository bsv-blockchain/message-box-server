# Overlay Service Deployment (for LARS)
This guide describes how to deploy the MessageBox overlay service located in the backend/ directory. This service integrates with SHIP and is deployed via LARS, the Lightweight Authenticated Routing Service.
________________________________________
### Purpose
This backend overlay service provides:
- Overlay advertisement parsing (via SHIP outputAdded)
- Identity key → host lookup resolution (via SHIP lookup)
- Host attestation storage (in overlay_ads table)
- Compatibility with SHIPBroadcaster and LookupResolver

This service does not run an HTTP or WebSocket server itself. It is meant to be mounted into LARS using a deployment config.
________________________________________
### Directory Overview
```bash
backend/
├── services/
│   ├── MessageBoxStorage.ts       # Storage logic using Knex
│   ├── MessageBoxLookupService.ts # SHIP lookup and advertisement parsing
│   ├── MessageBoxTopicManager.ts  # Signature verification for overlay TX outputs
├── migrations/                    # MySQL table for overlay_ads
├── MessageBoxLookupDocs.md.js     # Lookup documentation for LARS
├── MessageBoxTopicDocs.md.js      # TopicManager documentation for LARS
└── DEPLOYING.md                   # This file
```
________________________________________
### Deployment with LARS
This overlay service is meant to be plugged into LARS using deployment-info.json.
**Step 1:** Install and Run LARS
Follow setup instructions for LARS:
```bash
npm install -g @bsv/lars
mkdir my-overlay-project && cd my-overlay-project
lars init
```
________________________________________
**Step 2:** Mount MessageBox Overlay Code
Place the backend/ folder from MessageBox into your LARS src/ directory:
```css
my-overlay-project/
└── src/
    └── messagebox/
        └── [paste backend/ contents here]
```
________________________________________
**Step 3:** Configure LARS
Edit deployment-info.json in the LARS root:
```json
{
  "name": "messagebox-overlay",
  "sourceDirectory": "src/messagebox",
  "lookupService": "./services/MessageBoxLookupService.ts",
  "topicManagers": [
    "./services/MessageBoxTopicManager.ts"
  ],
  "migrationsDirectory": "./migrations"
}
```
________________________________________
### Database Setup
LARS will automatically apply the migration to create the overlay_ads table using:
```bash
lars start
```
Ensure that your database credentials are configured via LARS .env or system environment variables (e.g., KNEX_DB_CONNECTION).
Example MySQL table created:
```sql
CREATE TABLE overlay_ads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  identitykey VARCHAR(130),
  host TEXT,
  txid VARCHAR(64),
  output_index INT,
  timestamp DATETIME,
  nonce TEXT,
  signature TEXT,
  raw_advertisement JSON,
  created_at DATETIME
)
```
________________________________________
### Local Dev Testing
You can test overlay behavior using:
- @bsv/overlay-express or @bsv/sdk’s SHIPBroadcaster
- LookupResolver to resolve identity → host

The lookup method is exposed via the LARS overlay port (default: 3010):
```ts
import { LookupResolver } from '@bsv/sdk'

const resolver = new LookupResolver({
  networkPreset: 'local', // or 'test' or 'main'
  overlayPorts: {
    'tm_messagebox': 3010
  }
})

const host = await resolver.resolveHostForIdentity({
  identityKey: '03abc...'
})
```
________________________________________
### Environment Variables
Set KNEX_DB_CONNECTION to point to your MySQL instance, for example:
```json
{
  "client": "mysql2",
  "connection": {
    "host": "localhost",
    "user": "root",
    "password": "test",
    "database": "messagebox"
  }
}
```
This can be passed via LARS .env file or .larsrc.
________________________________________
### Documentation
This overlay service provides built-in docs through:
- getDocumentation() → Markdown content in MessageBoxLookupDocs.md.js
- getMetaData() → Service name and description for LARS UI
________________________________________
### What This Deploys
- A SHIP-compatible overlay service that:
    - Validates MessageBox overlay outputs
    - Parses and stores advertisement data
    - Answers SHIP lookup queries
- Includes full documentation and metadata
- Works seamlessly with the MetaNet client SDK
________________________________________
### Used By
- MessageBoxClient
- PeerPay
- Overlay-aware apps built using SHIP & Babbage
________________________________________
### License
This code is licensed under the Open BSV License.
________________________________________



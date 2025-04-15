export default `# MessageBox Topic Manager Docs

This overlay topic manages advertisements that associate identity keys with MessageBox hosts. These advertisements allow clients to discover where a given identity is hosted so messages can be routed accordingly.

## Use

- Advertise your MessageBox host by signing and broadcasting an advertisement with your identity key.
- Other participants will query the overlay network to find your host and send messages to it.

## Advertisement Format

Each advertisement must include:

- \`identityKey\`: The public key of the identity that owns the MessageBox.
- \`host\`: The full URL (including protocol) of the MessageBox server (e.g., \`https://msgbox.example.com\`).
- \`timestamp\`: The ISO string timestamp when the ad was created.
- \`nonce\`: A random value to differentiate multiple advertisements.
- \`signature\`: A valid signature over the payload, created with the identity key.

## Verification

The signature is checked before accepting any advertisement into the overlay. Invalid or outdated ads will be rejected.

## Topic Name

This overlay topic uses the name: \`lsmessagebox\`
`

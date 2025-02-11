const {
  NODE_ENV
} = process.env
const knex =
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)

module.exports = {
  type: 'post',
  path: '/sendMessage',
  knex,
  summary: "Use this route to send a message to a recipient's message box.",
  parameters: {
    message: {
      recipient: '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1',
      messageBox: 'payment_inbox',
      messageId: 'xyz123',
      body: '{}'
    }
  },
  exampleResponse: {
    status: 'success'
  },
  func: async (req, res) => {
    try {
      // Request Body Validation
      if (!req.body.message) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGE_REQUIRED',
          description: 'Please provide a valid message to send!'
        })
      }
      if (typeof req.body.message !== 'object') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGE',
          description: 'Message properties must be contained in a message object!'
        })
      }
      if (!req.body.message.recipient) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_RECIPIENT_REQUIRED',
          description: 'Please provide a recipient to send the message to!'
        })
      }
      if (typeof req.body.message.recipient !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_RECIPIENT',
          description: 'Recipient must be a compressed public key formatted as a hex string!'
        })
      }
      if (typeof req.body.message.messageId !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGEID',
          description: 'Please provide a unique counterparty specific messageID!'
        })
      }
      if (!req.body.message.messageBox) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGEBOX_REQUIRED',
          description: 'Please provide a messageBox to send this message into!'
        })
      }
      if (typeof req.body.message.messageBox !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGEBOX',
          description: 'MessageBox must be a string!'
        })
      }
      if (!req.body.message.body) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGE_BODY_REQUIRED',
          description: 'Every message must contain a body!'
        })
      }
      if (typeof req.body.message.body !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGE_BODY',
          description: 'Message body must be formatted as a string!'
        })
      }

      // Select the message box to send this message to
      let messageBox = await knex('messageBox')
        .where({
          identityKey: req.body.message.recipient,
          type: req.body.message.messageBox
        }).update({
          updated_at: new Date()
        })
      // If this messageBox does not exist yet, create it.
      if (!messageBox) {
        await knex('messageBox').insert({
          identityKey: req.body.message.recipient,
          type: req.body.message.messageBox,
          created_at: new Date(),
          updated_at: new Date()
        })
      }

      // Select the newly updated/created messageBox Id
      [messageBox] = await knex('messageBox').where({
        identityKey: req.body.message.recipient,
        type: req.body.message.messageBox
      }).select('messageBoxId')

      // Insert the new message
      // Note: Additional encryption could be enforced here
      try {
        await knex('messages').insert({
          messageId: req.body.message.messageId,
          messageBoxId: messageBox.messageBoxId, // Foreign key
          sender: req.authrite.identityKey,
          recipient: req.body.message.recipient,
          body: req.body.message.body, // Should a buffer be supported in the future?
          created_at: new Date(),
          updated_at: new Date()
        })
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({
            status: 'error',
            code: 'ERR_DUPLICATE_MESSAGE',
            description: 'Your message has already been sent to the intended recipient!'
          })
        }
        throw error
      }

      return res.status(200).json({
        status: 'success',
        message: `Your message has been sent to ${req.body.message.recipient}`
      })
    } catch (e) {
      console.error(e)
      if (global.Bugsnag) global.Bugsnag.notify(e)
      res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}

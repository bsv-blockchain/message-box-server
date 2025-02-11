
const {
  NODE_ENV
} = process.env
const knex =
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)

module.exports = {
  type: 'post',
  path: '/listMessages',
  knex,
  summary: 'Use this route to list messages from your messageBox.',
  parameters: {
    messageBox: 'The name of the messageBox you would like to list messages from.'
  },
  exampleResponse: {
    status: 'success',
    messages: [{
      messageId: '3301',
      body: '{}',
      sender: '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1'
    }]
  },
  func: async (req, res) => {
    try {
      // Validate a messageBox is provided and is a string
      if (!req.body.messageBox) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGEBOX_REQUIRED',
          description: 'Please provide the name of a valid MessageBox!'
        })
      }
      if (typeof req.body.messageBox !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGEBOX',
          description: 'MessageBox name must a string!'
        })
      }

      // Get the ID of the messageBox
      const [messageBox] = await knex('messageBox').where({
        identityKey: req.authrite.identityKey,
        type: req.body.messageBox
      }).select('messageBoxId')

      // Validate a match was found
      if (!messageBox) {
        return res.status(200).json({
          status: 'success',
          messages: []
        })
      }

      // Get all messages from the specified messageBox
      const messages = await knex('messages').where({
        recipient: req.authrite.identityKey,
        messageBoxId: messageBox.messageBoxId
      }).select('messageId', 'body', 'sender', 'created_at', 'updated_at')

      // Return a list of matching messages
      return res.status(200).json({
        status: 'success',
        messages
      })
    } catch (e) {
      console.error(e)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL_ERROR',
        description: 'An internal error has occurred while listing messages.'
      })
    }
  }
}

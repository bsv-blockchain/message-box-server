
const {
  NODE_ENV
} = process.env
const knex =
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)

module.exports = {
  type: 'post',
  path: '/acknowledgeMessage',
  knex,
  summary: 'Use this route to acknowledge a message has been received',
  parameters: {
    messageIds: ['3301']
  },
  exampleResponse: {
    status: 'success'
  },
  errors: [],
  func: async (req, res) => {
    try {
      // Validate request body
      if (!req.body.messageIds || (Array.isArray(req.body.messageIds) && req.body.messageIds.length === 0)) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGE_ID_REQUIRED',
          description: 'Please provide the ID of the message(s) to acknowledge!'
        })
      }
      if (!Array.isArray(req.body.messageIds) || req.body.messageIds.some(x => typeof x !== 'string')) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGE_ID',
          description: 'Message IDs must be formatted as an array of strings!'
        })
      }

      // The server removes the message after it has been acknowledged
      const deleted = await knex('messages').where({
        recipient: req.authrite.identityKey
      }).whereIn('messageId', req.body.messageIds).del()

      if (!deleted) {
        // Would this ever happen?
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_ACKNOWLEDGMENT',
          description: 'Message not found!'
        })
      }
      return res.status(200).json({
        status: 'success'
      })
    } catch (e) {
      console.error(e)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL_ERROR',
        description: 'An internal error has occurred while acknowledging the message'
      })
    }
  }
}

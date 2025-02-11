import { Request, Response } from 'express'
import knexConfig from '../../knexfile'
import knexLib from 'knex'

const { NODE_ENV = 'development' } = process.env

const knex = knexLib(
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexConfig.production
    : knexConfig.development
)

interface ListMessagesRequest extends Request {
  authrite: { identityKey: string }
  body: { messageBox?: string }
}

export default {
  type: 'post',
  path: '/listMessages',
  knex,
  summary: 'Use this route to list messages from your messageBox.',
  parameters: {
    messageBox: 'The name of the messageBox you would like to list messages from.'
  },
  exampleResponse: {
    status: 'success',
    messages: [
      {
        messageId: '3301',
        body: '{}',
        sender: '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1'
      }
    ]
  },
  func: async (req: ListMessagesRequest, res: Response): Promise<Response> => {
    try {
      const { messageBox } = req.body

      // Validate a messageBox is provided and is a string
      if (messageBox == null || messageBox === '') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_MESSAGEBOX_REQUIRED',
          description: 'Please provide the name of a valid MessageBox!'
        })
      }

      if (typeof messageBox !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_MESSAGEBOX',
          description: 'MessageBox name must be a string!'
        })
      }

      // Get the ID of the messageBox
      const [messageBoxRecord] = await knex('messageBox')
        .where({
          identityKey: req.authrite.identityKey,
          type: messageBox
        })
        .select('messageBoxId')

      // Validate a match was found
      if (messageBoxRecord === undefined) {
        return res.status(200).json({
          status: 'success',
          messages: []
        })
      }

      // Get all messages from the specified messageBox
      const messages = await knex('messages')
        .where({
          recipient: req.authrite.identityKey,
          messageBoxId: messageBoxRecord.messageBoxId
        })
        .select('messageId', 'body', 'sender', 'created_at', 'updated_at')

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

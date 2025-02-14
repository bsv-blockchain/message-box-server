import migrate from './migrate.js'
import sendMessage from './sendMessage.js'
import listMessages from './listMessages.js'
import acknowledgeMessage from './acknowledgeMessage.js'

export const preAuthrite = [migrate]

export const postAuthrite = [
  sendMessage,
  listMessages,
  acknowledgeMessage
]

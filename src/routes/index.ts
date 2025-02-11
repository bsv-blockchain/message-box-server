import migrate from './migrate'
import sendMessage from './sendMessage'
import listMessages from './listMessages'
import acknowledgeMessage from './acknowledgeMessage'

export const preAuthrite = [migrate]

export const postAuthrite = [
  sendMessage,
  listMessages,
  acknowledgeMessage
]

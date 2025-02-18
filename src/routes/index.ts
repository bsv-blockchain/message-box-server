import migrate from './migrate.js'
import sendMessage from './sendMessage.js'
import listMessages from './listMessages.js'
import acknowledgeMessage from './acknowledgeMessage.js'

// Explicitly type the exported arrays to avoid type inference issues
export const preAuthrite: Array<{ type: string, path: string, func: Function }> = [migrate]
export const postAuthrite: Array<{ type: string, path: string, func: Function }> = [
  sendMessage,
  listMessages,
  acknowledgeMessage
]

import migrate from './migrate.js';
import sendMessage from './sendMessage.js';
import listMessages from './listMessages.js';
import acknowledgeMessage from './acknowledgeMessage.js';
// Explicitly type the exported arrays to avoid type inference issues
export const preAuthrite = [migrate];
export const postAuthrite = [
    sendMessage,
    listMessages,
    acknowledgeMessage
];
//# sourceMappingURL=index.js.map
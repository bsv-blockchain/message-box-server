import { Request } from 'express';
export interface AuthriteRequest extends Request {
    authrite: {
        identityKey: string;
    };
    body: {
        messageIds?: string[];
    };
}
export interface Message {
    messageId: string;
    recipient: string;
    messageBox: string;
    body: string;
}
export interface SendMessageRequest extends Request {
    authrite: {
        identityKey: string;
    };
    body: {
        message?: Message;
    };
}
export interface AuthriteRequestMB extends Request {
    authrite: {
        identityKey: string;
    };
    body: {
        messageBox?: string;
    };
}
//# sourceMappingURL=testingInterfaces.d.ts.map
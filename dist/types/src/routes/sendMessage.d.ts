import { Request, Response } from 'express';
import * as knexLib from 'knex';
interface Message {
    recipient: string;
    messageBox: string;
    messageId: string;
    body: string;
}
interface SendMessageRequest extends Request {
    authrite: {
        identityKey: string;
    };
    body: {
        message?: Message;
    };
}
declare const _default: {
    type: string;
    path: string;
    knex: knexLib.Knex<any, any[]>;
    summary: string;
    parameters: {
        message: {
            recipient: string;
            messageBox: string;
            messageId: string;
            body: string;
        };
    };
    exampleResponse: {
        status: string;
    };
    func: (req: SendMessageRequest, res: Response) => Promise<Response>;
};
export default _default;
//# sourceMappingURL=sendMessage.d.ts.map
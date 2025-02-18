import { Request, Response } from 'express';
import * as knexLib from 'knex';
interface ListMessagesRequest extends Request {
    authrite: {
        identityKey: string;
    };
    body: {
        messageBox?: string;
    };
}
declare const _default: {
    type: string;
    path: string;
    knex: knexLib.Knex<any, any[]>;
    summary: string;
    parameters: {
        messageBox: string;
    };
    exampleResponse: {
        status: string;
        messages: {
            messageId: string;
            body: string;
            sender: string;
        }[];
    };
    func: (req: ListMessagesRequest, res: Response) => Promise<Response>;
};
export default _default;
//# sourceMappingURL=listMessages.d.ts.map
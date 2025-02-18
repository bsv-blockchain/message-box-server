import { Request, Response } from 'express';
import * as knexLib from 'knex';
export interface AcknowledgeRequest extends Request {
    authrite: {
        identityKey: string;
    };
    body: {
        messageIds?: string[];
    };
}
declare const _default: {
    type: string;
    path: string;
    knex: knexLib.Knex<any, any[]>;
    summary: string;
    parameters: {
        messageIds: string[];
    };
    exampleResponse: {
        status: string;
    };
    errors: any[];
    func: (req: AcknowledgeRequest, res: Response) => Promise<Response>;
};
export default _default;
//# sourceMappingURL=acknowledgeMessage.d.ts.map
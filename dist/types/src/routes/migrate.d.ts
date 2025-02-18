import { Request, Response } from 'express';
import * as knexLib from 'knex';
interface MigrateRequest extends Request {
    body: {
        migratekey?: string;
    };
}
declare const _default: {
    type: string;
    path: string;
    knex: knexLib.Knex<any, any[]>;
    hidden: boolean;
    func: (req: MigrateRequest, res: Response) => Promise<Response>;
};
export default _default;
//# sourceMappingURL=migrate.d.ts.map
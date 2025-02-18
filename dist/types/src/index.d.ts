import { AuthSocketServer } from '@bsv/authsocket';
declare const ROUTING_PREFIX: string;
declare const HTTP_PORT: number;
declare const http: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
declare const io: AuthSocketServer;
export { io, http, HTTP_PORT, ROUTING_PREFIX };
//# sourceMappingURL=index.d.ts.map
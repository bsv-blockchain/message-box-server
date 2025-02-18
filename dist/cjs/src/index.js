"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTING_PREFIX = exports.HTTP_PORT = exports.http = exports.io = void 0;
const dotenv = __importStar(require("dotenv"));
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const prettyjson_1 = __importDefault(require("prettyjson"));
const index_js_1 = require("./routes/index.js");
const child_process_1 = require("child_process");
const http_1 = require("http");
const authsocket_1 = require("@bsv/authsocket");
const auth_express_middleware_1 = require("@bsv/auth-express-middleware");
const sdk_1 = require("@bsv/sdk");
dotenv.config();
const app = (0, express_1.default)();
const { NODE_ENV = 'development', PORT, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
SERVER_PRIVATE_KEY, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
HOSTING_DOMAIN, ROUTING_PREFIX = '' } = process.env;
exports.ROUTING_PREFIX = ROUTING_PREFIX;
// Ensure PORT is properly handled
const parsedPort = Number(PORT);
const parsedEnvPort = Number(process.env.HTTP_PORT);
const HTTP_PORT = NODE_ENV !== 'development'
    ? 3000
    : !isNaN(parsedPort) && parsedPort > 0
        ? parsedPort
        : !isNaN(parsedEnvPort) && parsedEnvPort > 0
            ? parsedEnvPort
            : 8080;
exports.HTTP_PORT = HTTP_PORT;
// Initialize Wallet for Authentication
const wallet = new sdk_1.WalletClient();
const sessionManager = new sdk_1.SessionManager();
// Create HTTP server
const http = (0, http_1.createServer)((req, res) => {
    app(req, res).catch((err) => {
        console.error('Unhandled server error:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
    });
});
exports.http = http;
const io = new authsocket_1.AuthSocketServer(http, {
    wallet, // Required for signing
    sessionManager, // Manages authentication sessions
    cors: {
        origin: '*', // Allows all origins for WebSockets
        methods: ['GET', 'POST']
    }
});
exports.io = io;
// Configure JSON body parser
app.use(body_parser_1.default.json({ limit: '1gb', type: 'application/json' }));
// Initialize Auth Middleware
const authMiddleware = (0, auth_express_middleware_1.createAuthMiddleware)({
    wallet
});
// Force HTTPS unless in development mode
app.use((req, res, next) => {
    var _a, _b;
    const forwardedProto = (_a = req.get('x-forwarded-proto')) !== null && _a !== void 0 ? _a : '';
    const isSecure = req.secure === true;
    const host = (_b = req.get('host')) !== null && _b !== void 0 ? _b : '';
    if (!isSecure && forwardedProto !== 'https' && NODE_ENV !== 'development') {
        return res.redirect(`https://${host}${String(req.url)}`);
    }
    next();
});
// CORS Configuration
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Expose-Headers', '*');
    res.header('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
});
// Configure WebSocket Events (Now Using @bsv/authsocket)
io.on('connection', (socket) => {
    var _a;
    const identityKey = (_a = socket.identityKey) !== null && _a !== void 0 ? _a : 'unknown';
    console.log(`New authenticated WebSocket connection from: ${identityKey}`);
    socket.on('joinPrivateRoom', (roomId) => {
        void (async () => {
            try {
                await socket.ioSocket.join(roomId);
                console.log(`User joined private room: ${roomId}`);
            }
            catch (error) {
                console.error(`Failed to join private room: ${roomId}`, error);
            }
        })();
    });
    socket.on('joinRoom', (roomId) => {
        void (async () => {
            var _a;
            if (socket.identityKey != null && roomId.startsWith(socket.identityKey)) {
                try {
                    await socket.ioSocket.join(roomId);
                    console.log(`User joined room: ${roomId}`);
                }
                catch (error) {
                    console.error(`Failed to join room: ${roomId}`, error);
                }
            }
            else {
                console.warn(`Unauthorized room join attempt by: ${(_a = socket.identityKey) !== null && _a !== void 0 ? _a : 'unknown'}`);
            }
        })();
    });
    socket.on('leaveRoom', (roomId) => {
        void (async () => {
            try {
                await socket.ioSocket.leave(roomId);
                console.log(`User left room: ${roomId}`);
            }
            catch (error) {
                console.error(`Failed to leave room: ${roomId}`, error);
            }
        })();
    });
    socket.on('sendMessage', ({ roomId, message }) => {
        if (socket.identityKey === null || socket.identityKey === undefined) {
            console.warn('Unauthorized message attempt from unidentified socket.');
            return;
        }
        const dataToSend = {
            sender: socket.identityKey,
            message: typeof message === 'object' && Object.keys(message).length !== 0 ? message : String(message)
        };
        socket.ioSocket.broadcast.to(roomId).emit(`sendMessage-${roomId}`, dataToSend);
    });
    socket.on('disconnect', (reason) => {
        console.log(`Disconnected: ${reason}`);
    });
    socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`);
    });
    socket.on('reconnect_error', (error) => {
        console.log('Reconnection failed:', error);
    });
});
// Logger Middleware
app.use((req, res, next) => {
    console.log(`[${req.method}] <- ${req.url}`);
    console.log(prettyjson_1.default.render(req.body, { keysColor: 'blue' }));
    const originalJson = res.json.bind(res);
    res.json = (json) => {
        originalJson(json);
        console.log(`[${req.method}] -> ${req.url}`);
        console.log(prettyjson_1.default.render(json, { keysColor: 'green' }));
        return res;
    };
    next();
});
// Serve Static Files
app.use(express_1.default.static('public'));
// Pre-Auth Routes
index_js_1.preAuthrite.forEach((route) => {
    app[route.type](`${String(ROUTING_PREFIX)}${String(route.path)}`, route.func);
});
// Apply New Authentication Middleware
app.use(authMiddleware);
// Post-Auth Routes
index_js_1.postAuthrite.forEach((route) => {
    app[route.type](`${String(ROUTING_PREFIX)}${String(route.path)}`, route.func);
});
// 404 Route Not Found Handler
app.use((req, res) => {
    console.log('404', req.url);
    res.status(404).json({
        status: 'error',
        code: 'ERR_ROUTE_NOT_FOUND',
        description: 'Route not found.'
    });
});
// Start API Server
http.listen(HTTP_PORT, () => {
    console.log('MessageBox listening on port', HTTP_PORT);
    if (NODE_ENV !== 'development') {
        (0, child_process_1.spawn)('nginx', [], { stdio: ['inherit', 'inherit', 'inherit'] });
    }
});
//# sourceMappingURL=index.js.map
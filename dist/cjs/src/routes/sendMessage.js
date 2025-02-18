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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
const knexfile_js_1 = __importDefault(require("../../knexfile.js"));
const knexLib = __importStar(require("knex"));
const payment_express_middleware_1 = require("@bsv/payment-express-middleware");
const payment_js_1 = require("../utils/payment.js");
const sdk_1 = require("@bsv/sdk");
const { NODE_ENV = 'development' } = process.env;
const knex = (_c = (_b = (_a = knexLib).default) === null || _b === void 0 ? void 0 : _b.call(_a, NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexfile_js_1.default.production
    : knexfile_js_1.default.development)) !== null && _c !== void 0 ? _c : knexLib(NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexfile_js_1.default.production
    : knexfile_js_1.default.development);
// Initialize Wallet
const wallet = new sdk_1.WalletClient();
// Create Payment Middleware
const paymentMiddleware = (0, payment_express_middleware_1.createPaymentMiddleware)({
    wallet,
    calculateRequestPrice: async (req) => {
        const body = req.body;
        if (body == null || typeof body !== 'object') {
            return 0; // Default to 0 satoshis if body is invalid
        }
        const { message, priority = false } = body;
        if ((message === null || message === void 0 ? void 0 : message.body) != null && message.body.trim() !== '') {
            return (0, payment_js_1.calculateMessagePrice)(message.body, priority);
        }
        return 0;
    }
});
exports.default = {
    type: 'post',
    path: '/sendMessage',
    knex,
    summary: "Use this route to send a message to a recipient's message box.",
    parameters: {
        message: {
            recipient: '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1',
            messageBox: 'payment_inbox',
            messageId: 'xyz123',
            body: '{}'
        }
    },
    exampleResponse: {
        status: 'success'
    },
    func: async (req, res) => {
        try {
            await paymentMiddleware(req, res, (err) => {
                if (err != null) {
                    console.error('Payment Error:', err);
                    throw new Error('Payment required before sending messages.');
                }
            });
        }
        catch (err) {
            return res.status(402).json({
                status: 'error',
                code: 'ERR_PAYMENT_REQUIRED',
                description: 'Payment is required before sending messages.'
            });
        }
        try {
            const { message } = req.body;
            // Request Body Validation
            if (message == null) {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_MESSAGE_REQUIRED',
                    description: 'Please provide a valid message to send!'
                });
            }
            if (typeof message !== 'object') {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_INVALID_MESSAGE',
                    description: 'Message properties must be contained in a message object!'
                });
            }
            if (message.recipient === undefined || message.recipient === null || typeof message.recipient !== 'string' || message.recipient.trim() === '') {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_INVALID_RECIPIENT',
                    description: 'Recipient must be a compressed public key formatted as a hex string!'
                });
            }
            if (message.messageId === undefined || message.messageId === null || typeof message.messageId !== 'string') {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_INVALID_MESSAGEID',
                    description: 'Please provide a unique counterparty-specific messageID!'
                });
            }
            if (message.body === undefined || message.body === null) {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_MESSAGE_BODY_REQUIRED',
                    description: 'Message body is required!'
                });
            }
            else if (typeof message.messageBox !== 'string') {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_INVALID_MESSAGEBOX',
                    description: 'MessageBox must be a string!'
                });
            }
            if (message.body === undefined || message.body === null || typeof message.body !== 'string') {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_INVALID_MESSAGE_BODY',
                    description: 'Message body must be formatted as a string!'
                });
            }
            // Select the message box to send this message to
            const messageBox = await knex('messageBox')
                .where({
                identityKey: message.recipient,
                type: message.messageBox
            })
                .update({ updated_at: new Date() });
            // If this messageBox does not exist yet, create it
            if (messageBox === undefined || messageBox === 0) {
                await knex('messageBox').insert({
                    identityKey: message.recipient,
                    type: message.messageBox,
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }
            // Select the newly updated/created messageBox Id
            const [messageBoxRecord] = await knex('messageBox')
                .where({
                identityKey: message.recipient,
                type: message.messageBox
            })
                .select('messageBoxId');
            // Ensure messageBox exists before inserting the message
            if (messageBoxRecord === undefined || messageBoxRecord === null) {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_MESSAGEBOX_NOT_FOUND',
                    description: 'The specified messageBox does not exist.'
                });
            }
            // Insert the new message
            try {
                await knex('messages').insert({
                    messageId: message.messageId,
                    messageBoxId: messageBoxRecord.messageBoxId, // Foreign key
                    sender: req.authrite.identityKey,
                    recipient: message.recipient,
                    body: message.body,
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }
            catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({
                        status: 'error',
                        code: 'ERR_DUPLICATE_MESSAGE',
                        description: 'Your message has already been sent to the intended recipient!'
                    });
                }
                throw error;
            }
            return res.status(200).json({
                status: 'success',
                message: `Your message has been sent to ${message.recipient}`
            });
        }
        catch (e) {
            console.error(e);
            if (globalThis.Bugsnag != null)
                globalThis.Bugsnag.notify(e);
            return res.status(500).json({
                status: 'error',
                code: 'ERR_INTERNAL',
                description: 'An internal error has occurred.'
            });
        }
    }
};
//# sourceMappingURL=sendMessage.js.map
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
const { NODE_ENV = 'development' } = process.env;
const knex = (_c = (_b = (_a = knexLib).default) === null || _b === void 0 ? void 0 : _b.call(_a, NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexfile_js_1.default.production
    : knexfile_js_1.default.development)) !== null && _c !== void 0 ? _c : knexLib(NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexfile_js_1.default.production
    : knexfile_js_1.default.development);
exports.default = {
    type: 'post',
    path: '/acknowledgeMessage',
    knex,
    summary: 'Use this route to acknowledge a message has been received',
    parameters: {
        messageIds: ['3301']
    },
    exampleResponse: {
        status: 'success'
    },
    errors: [],
    func: async (req, res) => {
        try {
            const { messageIds } = req.body;
            // Validate request body
            if ((messageIds == null) || (Array.isArray(messageIds) && messageIds.length === 0)) {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_MESSAGE_ID_REQUIRED',
                    description: 'Please provide the ID of the message(s) to acknowledge!'
                });
            }
            if (!Array.isArray(messageIds) || messageIds.some(id => typeof id !== 'string')) {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_INVALID_MESSAGE_ID',
                    description: 'Message IDs must be formatted as an array of strings!'
                });
            }
            // The server removes the message after it has been acknowledged
            const deleted = await knex('messages')
                .where({ recipient: req.authrite.identityKey })
                .whereIn('messageId', Array.isArray(messageIds) ? messageIds : [messageIds])
                .del();
            if (deleted === 0) {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_INVALID_ACKNOWLEDGMENT',
                    description: 'Message not found!'
                });
            }
            if (deleted < 0) {
                throw new Error('Deletion failed');
            }
            return res.status(200).json({ status: 'success' });
        }
        catch (e) {
            console.error(e);
            return res.status(500).json({
                status: 'error',
                code: 'ERR_INTERNAL_ERROR',
                description: 'An internal error has occurred while acknowledging the message'
            });
        }
    }
};
//# sourceMappingURL=acknowledgeMessage.js.map
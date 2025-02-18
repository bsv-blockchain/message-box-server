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
    path: '/listMessages',
    knex,
    summary: 'Use this route to list messages from your messageBox.',
    parameters: {
        messageBox: 'The name of the messageBox you would like to list messages from.'
    },
    exampleResponse: {
        status: 'success',
        messages: [
            {
                messageId: '3301',
                body: '{}',
                sender: '028d37b941208cd6b8a4c28288eda5f2f16c2b3ab0fcb6d13c18b47fe37b971fc1'
            }
        ]
    },
    func: async (req, res) => {
        try {
            const { messageBox } = req.body;
            // Validate a messageBox is provided and is a string
            if (messageBox == null || messageBox === '') {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_MESSAGEBOX_REQUIRED',
                    description: 'Please provide the name of a valid MessageBox!'
                });
            }
            if (typeof messageBox !== 'string') {
                return res.status(400).json({
                    status: 'error',
                    code: 'ERR_INVALID_MESSAGEBOX',
                    description: 'MessageBox name must be a string!'
                });
            }
            // Get the ID of the messageBox
            const [messageBoxRecord] = await knex('messageBox')
                .where({
                identityKey: req.authrite.identityKey,
                type: messageBox
            })
                .select('messageBoxId');
            // Validate a match was found
            if (messageBoxRecord === undefined) {
                return res.status(200).json({
                    status: 'success',
                    messages: []
                });
            }
            // Get all messages from the specified messageBox
            const messages = await knex('messages')
                .where({
                recipient: req.authrite.identityKey,
                messageBoxId: messageBoxRecord.messageBoxId
            })
                .select('messageId', 'body', 'sender', 'created_at', 'updated_at');
            // Return a list of matching messages
            return res.status(200).json({
                status: 'success',
                messages
            });
        }
        catch (e) {
            console.error(e);
            return res.status(500).json({
                status: 'error',
                code: 'ERR_INTERNAL_ERROR',
                description: 'An internal error has occurred while listing messages.'
            });
        }
    }
};
//# sourceMappingURL=listMessages.js.map
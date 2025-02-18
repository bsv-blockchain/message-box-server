"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postAuthrite = exports.preAuthrite = void 0;
const migrate_js_1 = __importDefault(require("./migrate.js"));
const sendMessage_js_1 = __importDefault(require("./sendMessage.js"));
const listMessages_js_1 = __importDefault(require("./listMessages.js"));
const acknowledgeMessage_js_1 = __importDefault(require("./acknowledgeMessage.js"));
// Explicitly type the exported arrays to avoid type inference issues
exports.preAuthrite = [migrate_js_1.default];
exports.postAuthrite = [
    sendMessage_js_1.default,
    listMessages_js_1.default,
    acknowledgeMessage_js_1.default
];
//# sourceMappingURL=index.js.map
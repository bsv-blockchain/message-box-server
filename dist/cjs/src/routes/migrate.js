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
const { NODE_ENV = 'development', MIGRATE_KEY } = process.env;
const knex = (_c = (_b = (_a = knexLib).default) === null || _b === void 0 ? void 0 : _b.call(_a, NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexfile_js_1.default.production
    : knexfile_js_1.default.development)) !== null && _c !== void 0 ? _c : knexLib(NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? knexfile_js_1.default.production
    : knexfile_js_1.default.development);
exports.default = {
    type: 'post',
    path: '/migrate',
    knex,
    hidden: true,
    func: async (req, res) => {
        if (typeof MIGRATE_KEY === 'string' &&
            MIGRATE_KEY.length > 10 &&
            req.body.migratekey === MIGRATE_KEY) {
            try {
                const result = await knex.migrate.latest();
                return res.status(200).json({
                    status: 'success',
                    result
                });
            }
            catch (error) {
                console.error('Migration error:', error);
                return res.status(500).json({
                    status: 'error',
                    code: 'ERR_MIGRATION_FAILED',
                    description: 'An error occurred during the migration process.'
                });
            }
        }
        else {
            return res.status(401).json({
                status: 'error',
                code: 'ERR_UNAUTHORIZED',
                description: 'Access with this key was denied.'
            });
        }
    }
};
//# sourceMappingURL=migrate.js.map
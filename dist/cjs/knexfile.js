"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config = {
    client: 'mysql',
    connection: process.env.KNEX_DB_CONNECTION !== undefined && process.env.KNEX_DB_CONNECTION !== ''
        ? JSON.parse(process.env.KNEX_DB_CONNECTION)
        : undefined,
    useNullAsDefault: true,
    migrations: {
        directory: './src/migrations',
        extension: 'ts'
    },
    pool: {
        min: 0,
        max: 7,
        idleTimeoutMillis: 15000
    }
};
const knexConfig = {
    development: config,
    staging: config,
    production: config
};
exports.default = knexConfig;
//# sourceMappingURL=knexfile.js.map
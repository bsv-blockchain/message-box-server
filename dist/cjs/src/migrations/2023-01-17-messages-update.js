"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.alterTable('messages', (table) => {
        table.dropColumn('acknowledged');
    });
}
async function down(knex) {
    await knex.schema.alterTable('messages', (table) => {
        table.boolean('acknowledged').defaultTo(false);
    });
}
//# sourceMappingURL=2023-01-17-messages-update.js.map
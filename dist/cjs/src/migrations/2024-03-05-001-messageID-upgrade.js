"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    // Drop the existing 'messageId' column
    await knex.schema.alterTable('messages', (table) => {
        table.dropColumn('messageId');
    });
    // Add 'messageId' back as a unique string
    await knex.schema.alterTable('messages', (table) => {
        table.string('messageId').unique().notNullable();
    });
}
async function down(knex) {
    // Drop the new 'messageId' column
    await knex.schema.alterTable('messages', (table) => {
        table.dropColumn('messageId');
    });
    // Restore 'messageId' as an auto-incrementing primary key
    await knex.schema.alterTable('messages', (table) => {
        table.increments('messageId').primary();
    });
}
//# sourceMappingURL=2024-03-05-001-messageID-upgrade.js.map
export async function up(knex) {
    await knex.schema.alterTable('messages', (table) => {
        table.dropColumn('acknowledged');
    });
}
export async function down(knex) {
    await knex.schema.alterTable('messages', (table) => {
        table.boolean('acknowledged').defaultTo(false);
    });
}
//# sourceMappingURL=2023-01-17-messages-update.js.map
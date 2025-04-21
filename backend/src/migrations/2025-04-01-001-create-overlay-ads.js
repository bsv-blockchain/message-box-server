export async function up(knex) {
    await knex.schema.createTable('overlay_ads', (table) => {
        table.increments('id').primary();
        table.string('identityKey').notNullable().index();
        table.string('host').notNullable();
        table.timestamp('timestamp').notNullable();
        table.text('nonce').notNullable();
        table.text('signature').notNullable();
        table.string('txid').notNullable();
        table.integer('output_index').notNullable();
        table.json('raw_advertisement').notNullable();
        table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    });
}
export async function down(knex) {
    await knex.schema.dropTableIfExists('overlay_ads');
}
//# sourceMappingURL=2025-04-01-001-create-overlay-ads.js.map
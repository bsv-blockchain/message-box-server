import { Knex } from 'knex'

export async function up (knex: Knex): Promise<void> {
  await knex.schema.createTable('overlay_ads', (table) => {
    table.increments('id').primary()
    table.string('identityKey').notNullable().index()
    table.string('host').notNullable()
    table.timestamp('timestamp', { useTz: false }).notNullable()
    table.text('nonce').notNullable()
    table.text('signature').notNullable()
    table.json('raw_advertisement').notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
    table.integer('output_index').notNullable().defaultTo(0)
    table.string('txid', 64).notNullable()
  })
}

export async function down (knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('overlay_ads')
}

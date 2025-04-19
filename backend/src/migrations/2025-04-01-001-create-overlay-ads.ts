import { Knex } from 'knex'

export async function up (knex: Knex): Promise<void> {
  await knex.schema.createTable('overlay_ads', (table) => {
    table.increments('id').primary()

    table.string('identityKey').notNullable().index()
    table.string('host').notNullable()
    table.timestamp('timestamp').notNullable()
    table.text('nonce').notNullable()
    table.text('signature').notNullable()
    table.string('txid').notNullable()
    table.integer('output_index').notNullable()
    table.json('raw_advertisement').notNullable()
    table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
  })
}

export async function down (knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('overlay_ads')
}

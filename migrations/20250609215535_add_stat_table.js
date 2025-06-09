/**
 * This statistics table only works in simple-web and web-with-replica.
 * In other cases, statistics data are stored in cache.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable("activity_log", (table) => {
      table.increments("id").primary();
      table.string("method").notNullable();
      table.string("url").notNullable();
      table.integer("user_id").references("id").inTable("users").nullable();
      table.integer("processing_time").notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.dropTable("activity_log"),
  ]);
};

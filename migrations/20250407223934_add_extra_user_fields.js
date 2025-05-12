/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable("user_extra_info", (table) => {
      table.integer("user_id").primary().references("id").inTable("users");
      table.string("self_remark").defaultTo("");
    }),
    knex.schema.createTable("user_valid_sessions", (table) => {
      table.integer("user_id").primary().references("id").inTable("users");
      table.string("session_id").notNullable();
      table.boolean('active').defaultTo(true);
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
    knex.schema.dropTable("user_extra_info"),
    knex.schema.dropTable("user_valid_sessions"),
  ]);
};

/**
 * This statistics table only works in simple-web and web-with-replica.
 * In other cases, statistics data are stored in cache.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable("db_change_log", (table) => {
      // This table should have a primary key id, which is an uuid, not null string column topic, not null number column ingression_ts, 
      // not null object column headers and message, timestamp modified_at which will be now() whenever the record is inserted or updated,
      // not null string column status, default is pending, also can be success or failed, and a timestamp created_at which will be now() whenever the record is inserted.
      table.uuid("id").primary();
      table.string("topic").notNullable();
      table.bigInteger("ingression_ts").notNullable();
      table.json("headers").notNullable();
      table.json("message").notNullable();
      table.string("status").notNullable().defaultTo("pending").checkIn(["pending", "success", "failed"]);
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("modified_at").defaultTo(knex.fn.now());
    }),
    knex.raw(`
      CREATE OR REPLACE FUNCTION update_modified_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.modified_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `),
    knex.raw(`
      CREATE TRIGGER update_modified_at
      BEFORE UPDATE ON db_change_log
      FOR EACH ROW
      EXECUTE FUNCTION update_modified_at_column();
    `),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.raw(`DROP TRIGGER IF EXISTS update_modified_at ON db_change_log;`),
    knex.raw(`DROP FUNCTION IF EXISTS update_modified_at_column;`),
    knex.schema.dropTable("db_change_log"),
  ]);
};

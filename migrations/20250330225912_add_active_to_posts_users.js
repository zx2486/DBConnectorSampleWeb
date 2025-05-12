/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    // Add 'active' column to 'users' table
    knex.schema.alterTable('users', (table) => {
      table.boolean('active').defaultTo(true);
    }),

    // Add 'active' column to 'posts' table
    knex.schema.alterTable('posts', (table) => {
      table.boolean('active').defaultTo(true);
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    // Remove 'active' column from 'users' table
    knex.schema.alterTable('users', (table) => {
      table.dropColumn('active');
    }),

    // Remove 'active' column from 'posts' table
    knex.schema.alterTable('posts', (table) => {
      table.dropColumn('active');
    }),
  ]);
};

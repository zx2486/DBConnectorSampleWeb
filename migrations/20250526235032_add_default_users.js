/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  // insert default users into the users table
  return knex("users").insert([
    { id: 1, username: "Alice", salt: 11, password: "$2b$10$p7ZqS264Z0kyKa3MypVhbO3XSyAPFVysz9L/6GBqXvpKlTjTQ52KK", active: true },
    { id: 2, username: "Bob", salt: 33, password: "$2b$10$6p0Mi/MVz0.CPPzvRumW0u7o8bXKJh4eq9.XBUXnVvMw300mIkjIi", active: true }
  ]).then(() =>
    knex.raw(`ALTER SEQUENCE users_id_seq RESTART WITH 3`)
  );
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  // delete default users from the users table
  return knex("users").whereIn("id", [1, 2]).del().then(() =>
    knex.raw(`ALTER SEQUENCE users_id_seq RESTART WITH 1`)
  );
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  // insert default users into the users table
  return knex("users").insert([
    { id: 1, username: "Alice", age: 11, password: "$2b$10$p7ZqS264Z0kyKa3MypVhbO3XSyAPFVysz9L/6GBqXvpKlTjTQ52KK", active: true },
    { id: 2, username: "Bob", age: 33, password: "$2b$10$6p0Mi/MVz0.CPPzvRumW0u7o8bXKJh4eq9.XBUXnVvMw300mIkjIi", active: true }
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  // delete default users from the users table
  return knex("users").whereIn("id", [1, 2]).del();
};

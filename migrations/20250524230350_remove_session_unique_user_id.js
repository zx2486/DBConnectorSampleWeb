/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // First, identify the primary key constraint name
  const constraintInfo = await knex.raw(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'user_valid_sessions' AND constraint_type = 'PRIMARY KEY';
  `);

  // Drop the existing primary key constraint by name
  if (constraintInfo.rows && constraintInfo.rows.length > 0) {
    const constraintName = constraintInfo.rows[0].constraint_name;
    await knex.raw(`ALTER TABLE user_valid_sessions DROP CONSTRAINT "${constraintName}"`);
  }

  return knex.schema.alterTable("user_valid_sessions", (table) => {
    // Drop the existing primary key constraint
    // table.dropPrimary();

    // Alter session_id to be the primary key and unique
    table.string("session_id").primary().alter();

    // Alter user_id to be NOT NULL but not unique or primary
    table.integer("user_id").notNullable().alter();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // First, identify the primary key constraint name
  const constraintInfo = await knex.raw(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'user_valid_sessions' AND constraint_type = 'PRIMARY KEY';
  `);

  // Drop the existing primary key constraint by name
  if (constraintInfo.rows && constraintInfo.rows.length > 0) {
    const constraintName = constraintInfo.rows[0].constraint_name;
    await knex.raw(`ALTER TABLE user_valid_sessions DROP CONSTRAINT "${constraintName}"`);
  }

  return knex.schema.alterTable("user_valid_sessions", (table) => {
    // Drop the primary key on session_id
    // table.dropPrimary();

    // Restore user_id as the primary key
    table.integer("user_id").primary().alter();

    // Allow session_id to be not unique and not a primary key
    table.string("session_id").notNullable().alter();
  });
};

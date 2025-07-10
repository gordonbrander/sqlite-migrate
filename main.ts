import type { DatabaseSync } from "node:sqlite";

/**
 * A migration is a function that takes a `DatabaseSync instance and performs a database schema change.
 * Migrations are executed within a transaction, and safely roll back on failure.
 */
export type Migration = (db: DatabaseSync) => void;

/**
 * Get the current migration version from the database
 */
export const getVersion = (db: DatabaseSync): number => {
  const result = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  return result.user_version;
};

/**
 * Set the migration version in the database
 * Typically handled by `migrate()`.
 */
export const setVersion = (db: DatabaseSync, version: number): void => {
  db.exec(`PRAGMA user_version = ${version}`);
};

/** Receipt for migration result */
export type MigrationReceipt = {
  /** The version we successfully migrated to */
  version: number;
  /** Any error encountered during migration */
  error: Error | undefined;
};

/**
 * Run migrations on the provided database and return a migration receipt.
 * Each `Migration` is a plain function that takes a `DatabaseSync` connection and performs the
 * migration.
 *
 * Each migration is run in a transaction. If the migration fails, the database is rolled back to
 * the last good version.
 *
 * `migrate()` will only run migrations that have not been applied yet.
 *
 * The migration version number is derived from the migration's position in the array (index + 1).
 * After each successful migration, SQLite's `user_version` pragma to the migration version.
 *
 * @param db - DatabaseSync instance from node:sqlite
 * @param migrations - Array of migration functions
 * @returns The version of the last successfully applied migration (0-based index)
 * @throws Error if a migration fails and cannot be rolled back
 */
export const migrate = (
  db: DatabaseSync,
  migrations: Migration[],
): MigrationReceipt => {
  const currentVersion = getVersion(db);
  let lastGoodVersion = currentVersion;

  // Run each migration sequentially
  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];

    const version = i + 1;
    // Skip migration if it has already been applied
    if (version <= currentVersion) continue;

    try {
      // Begin transaction
      db.exec("BEGIN TRANSACTION");

      // Execute migration function
      migration(db);

      // Update user_version to migration index
      setVersion(db, version);

      // Commit transaction
      db.exec("COMMIT");

      // Set last good version
      lastGoodVersion = version;
    } catch (error) {
      db.exec("ROLLBACK");
      return {
        version: lastGoodVersion,
        error: error as Error,
      };
    }
  }

  return {
    version: lastGoodVersion,
    error: undefined,
  };
};

export default migrate;

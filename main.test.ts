import { assertEquals } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { getVersion, migrate, type Migration } from "./main.ts";

const createTestDb = () => new DatabaseSync(":memory:");

Deno.test("migrate() - empty migrations array returns 0", () => {
  const db = createTestDb();
  const result = migrate(db, []);
  assertEquals(result.version, 0);
  assertEquals(getVersion(db), 0);
  db.close();
});

Deno.test("migrate() - single migration runs successfully", () => {
  const db = createTestDb();

  const migrations: Migration[] = [
    (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `);
    },
  ];

  const result = migrate(db, migrations);
  assertEquals(result.version, 1);
  assertEquals(getVersion(db), 1);

  // Verify table was created
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
    )
    .all();
  assertEquals(tables.length, 1);

  db.close();
});

Deno.test("migrate() - multiple migrations run in sequence", () => {
  const db = createTestDb();

  const migrations: Migration[] = [
    (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `);
    },
    (db: DatabaseSync) => {
      db.exec(`
        ALTER TABLE users ADD COLUMN email TEXT;
      `);
    },
    (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          title TEXT NOT NULL
        );
      `);
    },
  ];

  const result = migrate(db, migrations);
  assertEquals(result.version, 3);
  assertEquals(getVersion(db), 3);

  // Verify all tables and columns exist
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'posts')",
    )
    .all();
  assertEquals(tables.length, 2);

  const userColumns = db.prepare("PRAGMA table_info(users)").all();
  assertEquals(userColumns.length, 3); // id, name, email

  db.close();
});

Deno.test("migrate() - handles migration failure with rollback", () => {
  const db = createTestDb();

  const migrations: Migration[] = [
    (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `);
    },
    (db: DatabaseSync) => {
      // This will fail - trying to create table that already exists
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          different_column TEXT
        );
      `);
    },
    (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL
        );
      `);
    },
  ];

  const result = migrate(db, migrations);
  assertEquals(result.version, 1); // Should return last successful migration
  assertEquals(getVersion(db), 1);

  // Verify first migration succeeded, second failed, third didn't run
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all();
  const tableNames = tables.map((t) => t.name);
  assertEquals(tableNames.includes("users"), true);
  assertEquals(tableNames.includes("posts"), false);

  db.close();
});

Deno.test("migrate() - is idempotent", () => {
  const db = createTestDb();

  const migrations: Migration[] = [
    (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `);
    },
    (db: DatabaseSync) => {
      db.exec(`
        ALTER TABLE users ADD COLUMN email TEXT;
      `);
    },
  ];

  // Run migrations first time
  const result1 = migrate(db, migrations);
  assertEquals(result1.version, 2);
  assertEquals(getVersion(db), 2);

  // Run migrations second time - should be idempotent
  const result2 = migrate(db, migrations);
  assertEquals(result2.version, 2);
  assertEquals(getVersion(db), 2);

  db.close();
});

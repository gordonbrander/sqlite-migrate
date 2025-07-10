# sqlite-migrate

A minimal SQLite migration library for Deno and Node.js.

- **Minimal**: Simple API (one function)
- **Zero dependencies**: Uses SQLite bundled with Deno/Node.js
- **No bells, no whistles**. Migrations are plain functions. No rollback, only forward migration.

## Installation

```typescript
import { migrate, getVersion, setVersion } from "jsr:@gordonb/sqlite-migrate";
```

Or via Deno add:

```bash
deno add jsr:@gordonb/sqlite-migrate
```

## Usage

```typescript
import { DatabaseSync } from "node:sqlite";
import migrate from "@gordonb/sqlite-migrate";

const db = new DatabaseSync("./database.db");

const result = migrate(db, [
  (db: DatabaseSync) => {
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE
      );
    `);
  },
  (db: DatabaseSync) => {
    db.exec(`
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        title TEXT NOT NULL,
        content TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
  },
]);

console.log(`Migrated to version ${result.version}`);

if (result.error) {
  console.error("Migration failed:", result.error);
}

db.close();
```

## How It Works

1. Uses SQLite's `PRAGMA user_version` to track migration state
2. Executes migrations sequentially, skipping already applied ones
3. Each migration runs in a transaction with automatic rollback on failure
4. Returns the version of the last successfully applied migration

## Testing

```bash
deno test
```

## License

MIT

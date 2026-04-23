#!/usr/bin/env node
import { Pool } from "@neondatabase/serverless";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("No DATABASE_URL set — skipping migrations.");
    return;
  }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const appliedRows = await client.query(`SELECT filename FROM schema_migrations`);
    const applied = new Set(appliedRows.rows.map((r) => r.filename));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`✓ ${file} (already applied)`);
        continue;
      }
      const body = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      console.log(`→ applying ${file}...`);
      await client.query("BEGIN");
      try {
        await client.query(body);
        await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
        await client.query("COMMIT");
        console.log(`✓ ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    console.log("Migrations up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

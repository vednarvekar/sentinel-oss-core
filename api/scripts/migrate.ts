import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      appilied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrationNames() {
  const res = await pool.query<{ name: string }>("SELECT name FROM migrations");
  return new Set(res.rows.map((row) => row.name));
}

async function run() {
  const migrationsDir = path.resolve(process.cwd(), "migrations");
  const entries = await fs.readdir(migrationsDir);
  const files = entries.filter((f) => f.endsWith(".sql")).sort();

  await ensureMigrationsTable();
  const applied = await getAppliedMigrationNames();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipping already applied migration: ${file}`);
      continue;
    }

    const fullPath = path.join(migrationsDir, file);
    const sql = await fs.readFile(fullPath, "utf-8");

    console.log(`Applying migration: ${file}`);
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO migrations(name) VALUES($1)", [file]);
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  console.log("Migrations complete.");
}

run()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

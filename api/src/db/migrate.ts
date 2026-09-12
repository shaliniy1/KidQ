import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";

// Same depth from src/db (tsx) and dist/db (compiled), so this resolves to api/db/migrations.
const MIGRATIONS_DIR = path.resolve(__dirname, "../../db/migrations");
const ADVISORY_LOCK_ID = 7_406_001;

// Supabase exposes the public schema over REST. RLS with no policies denies the anon and
// authenticated roles; the API connects as the table owner, which bypasses RLS.
// Re-run after every migration so tables added later are covered too.
export const ENSURE_RLS_SQL = `
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;`;

export async function runMigrations(pool: Pool, log: (message: string) => void = console.log) {
  const client = await pool.connect();
  try {
    // Several API instances may boot at once; only one applies migrations.
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_ID]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const applied = new Set(
      (await client.query<{ version: string }>("SELECT version FROM schema_migrations")).rows.map((row) => row.version),
    );

    // 001 may have been applied by hand with psql (per the content-curation README) before this runner existed.
    const baseline = "001_content_catalog";
    const hasCatalog = (await client.query("SELECT to_regclass('public.content_items') IS NOT NULL AS present")).rows[0].present;
    if (!applied.has(baseline) && hasCatalog) {
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [baseline]);
      applied.add(baseline);
      log(`baselined ${baseline} (schema already present)`);
    }

    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      if (applied.has(version)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
        await client.query("COMMIT");
        log(`applied ${version}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${version} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await client.query(ENSURE_RLS_SQL);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

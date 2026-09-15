// Sample content for local development, and syncing already-pulled-and-scored content between
// environments (e.g. onto a freshly deployed prod that has no content yet): the pulled items with
// their scores, categories and review history, so an environment's admin shows a real library without
// needing YouTube or Gemini keys of its own.
//   npm run seed:sample -w api           # load into a fresh local database (does nothing if it has content)
//   npm run seed:sample:export -w api    # refresh db/seed/sample-content.json.gz from your database
//   npm run seed:sample:sync -w api      # add anything missing to a database that already has some content
// Only content is exported: never families, sessions, analytics, submissions, the job queue or keys,
// and anyone named in the review history becomes "KidQ admin (sample)".
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { runMigrations } from "../src/db/migrate";
import { closePool, getPool, withTransaction } from "../src/db/pool";

type Row = Record<string, unknown>;
const FILE = path.join(__dirname, "../db/seed/sample-content.json.gz");
const SAMPLE_ADMIN = "KidQ admin (sample)";
const person = (value: unknown) => (typeof value === "string" && (value.includes("@") || value.startsWith("parent:")) ? SAMPLE_ADMIN : value);

// Every table comes after the ones it references.
// `key` names each table's primary key columns (default ["id"]) — the conflict target for a re-run.
const TABLES: Array<{ name: string; key?: string[]; scrub?: (row: Row) => Row }> = [
  { name: "ingestion_runs", scrub: (row) => ({ ...row, requested_by: person(row.requested_by) }) },
  { name: "content_items" },
  { name: "source_records" },
  { name: "rights_assertions" },
  { name: "transcripts" },
  { name: "assessments", scrub: (row) => ({ ...row, assessor_name: person(row.assessor_name) }) },
  { name: "assessment_criteria", key: ["assessment_id", "criterion_key"] },
  { name: "assessment_scores", key: ["assessment_id", "component"] },
  { name: "kidq_scores" },
  { name: "publication_decisions", scrub: (row) => ({ ...row, decided_by: person(row.decided_by), decided_by_user_id: null }) },
  { name: "editorial_revisions", scrub: (row) => ({ ...row, edited_by: person(row.edited_by), edited_by_user_id: null }) },
];

async function exportSample() {
  const db = getPool();
  const tables: Record<string, Row[]> = {};
  for (const table of TABLES) {
    const { rows } = await db.query(`SELECT to_jsonb(t) AS row FROM ${table.name} t ORDER BY to_jsonb(t)->>'id', to_jsonb(t)::text`);
    tables[table.name] = rows.map(({ row }) => (table.scrub ? table.scrub(row) : row));
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, zlib.gzipSync(JSON.stringify({ format: 1, exported_at: new Date().toISOString(), tables })));
  for (const table of TABLES) console.log(`${table.name}: ${tables[table.name].length}`);
  console.log(`wrote ${path.relative(process.cwd(), FILE)} (${Math.round(fs.statSync(FILE).size / 1024)} KB)`);
}

function readSample(): { tables: Record<string, Row[]> } {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(FILE)).toString("utf8"));
}

/**
 * Inserts every row not already present (matched by id). Safe to run more than once, and safe to run
 * against a database that already has some content of its own — it only ever adds, never overwrites
 * or removes a row that's already there.
 */
async function insertMissing(data: { tables: Record<string, Row[]> }) {
  await withTransaction(async (client) => {
    for (const table of TABLES) {
      const rows = data.tables[table.name] ?? [];
      const conflictKey = (table.key ?? ["id"]).join(", ");
      const { rowCount } = rows.length
        ? await client.query(
            `INSERT INTO ${table.name} SELECT * FROM jsonb_populate_recordset(NULL::${table.name}, $1::jsonb) ON CONFLICT (${conflictKey}) DO NOTHING`,
            [JSON.stringify(rows)],
          )
        : { rowCount: 0 };
      console.log(`${table.name}: ${rowCount ?? 0} added (${rows.length} in the sample)`);
    }
  });
}

async function loadSample() {
  const db = getPool();
  await runMigrations(db, () => undefined);
  const existing = (await db.query("SELECT count(*)::int AS n FROM content_items")).rows[0].n as number;
  if (existing > 0) {
    console.log(`This database already has ${existing} content items, so nothing was loaded. Use "sync" to add what's missing instead.`);
    return;
  }
  await insertMissing(readSample());
  console.log("Sample content loaded.");
}

async function syncSample() {
  const db = getPool();
  await runMigrations(db, () => undefined);
  await insertMissing(readSample());
  console.log("Sync complete: anything already present was left untouched.");
}

const command = process.argv[2];
const run = command === "export" ? exportSample : command === "load" ? loadSample : command === "sync" ? syncSample : null;
(run ? run() : Promise.reject(new Error("Use: sample-content.ts load | sync | export")))
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);

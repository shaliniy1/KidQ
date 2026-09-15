import { Pool, type PoolClient, type PoolConfig } from "pg";
import { env } from "../config/env";

/** Anything that can run a query: the pool, or a client inside a transaction. */
export type Db = Pool | PoolClient;

function sslConfig(): PoolConfig["ssl"] {
  if (env.databaseSsl === "disable") return false;
  // Supabase pooler: encrypted connection. Use verify-full + DATABASE_CA_CERT in prod.
  if (env.databaseSsl === "require") return { rejectUnauthorized: false };
  return { rejectUnauthorized: true, ca: env.databaseCaCert };
}

let pool: Pool | undefined;

export function getPool(): Pool {
  pool ??= new Pool({ connectionString: env.databaseUrl, ssl: sslConfig(), max: env.dbPoolMax });
  return pool;
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool?.end();
  pool = undefined;
}

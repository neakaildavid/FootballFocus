import { Pool, type QueryResultRow } from "pg";

// A single pooled connection, reused across requests. Guarded on
// globalThis so Next.js dev's module-reload-on-change doesn't spin up a
// fresh pool (and leak connections) on every edit.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set — copy .env.example to web/.env.local and fill it in.");
    }
    globalForDb.pgPool = new Pool({ connectionString, max: 10 });
  }
  return globalForDb.pgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

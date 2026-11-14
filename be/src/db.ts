import pg from "pg";

/** The slice of a database connection the services use. Implemented by node-postgres and by PGlite in tests. */
export interface Queryable {
  query<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface Db extends Queryable {
  exec(sql: string): Promise<unknown>;
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Postgres type parsers shared by both drivers: DATE stays "YYYY-MM-DD", NUMERIC becomes a number. */
export const TYPE_PARSERS = {
  1082: (value: string) => value,
  1700: (value: string) => Number(value),
};

pg.types.setTypeParser(1082, TYPE_PARSERS[1082]);
pg.types.setTypeParser(1700, TYPE_PARSERS[1700]);

/** Today's date in WIB, computed by the database so it matches record_attempt(). */
export const TODAY_WIB = "(now() at time zone 'Asia/Jakarta')::date";

export function createPgDb(url: string, poolMax = 10): Db {
  const local = /localhost|127\.0\.0\.1/.test(url);
  const pool = new pg.Pool({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false }, // Supabase pooler uses its own CA
    max: poolMax,
  });
  return {
    query: <T>(text: string, params?: unknown[]) =>
      pool.query(text, params as unknown[]) as unknown as Promise<{ rows: T[] }>,
    exec: (sql) => pool.query(sql),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn({
          query: <T>(text: string, params?: unknown[]) =>
            client.query(text, params as unknown[]) as unknown as Promise<{ rows: T[] }>,
        });
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

let current: Db | null = null;

export function setDb(db: Db): void {
  current = db;
}

export function db(): Db {
  if (!current) throw new Error("Database belum diinisialisasi");
  return current;
}

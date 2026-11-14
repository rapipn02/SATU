import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "./db";

export const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../supabase/migrations");

/** Applies supabase/migrations/*.sql in name order, once each (tracked in schema_migrations). */
export async function runMigrations(database: Db, log: (message: string) => void = () => {}): Promise<void> {
  await database.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const { rows } = await database.query<{ name: string }>("select name from schema_migrations");
  const applied = new Set(rows.map((r) => r.name));
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    await database.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    await database.query("insert into schema_migrations (name) values ($1)", [file]);
    log(`applied ${file}`);
  }
}

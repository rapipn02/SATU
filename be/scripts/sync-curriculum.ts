/**
 * Fills the GENERATED block of supabase/migrations/004_ml_curriculum.sql from the ML service,
 * so the `levels` table always matches the curriculum the ML teammate owns.
 *
 *   uvicorn main:app --port 8000        (in aisatu-main/backend)
 *   npm run sync:curriculum             (AI_URL from .env, or: AI_URL=http://127.0.0.1:8000/ai npm run sync:curriculum)
 *
 * Then run the migration in the Supabase SQL Editor. Re-run when the ML curriculum changes
 * (and add a new migration instead of editing 004 once it has been applied).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "../src/config";
import { levelsSql } from "../src/lib/curriculum-sql";
import { mlFetchRaw } from "../src/lib/ml-client";

const base = config.AI_URL;
if (!base) throw new Error("Isi AI_URL (alamat layanan ML, contoh http://127.0.0.1:8000/ai)");

const kurikulum = await mlFetchRaw(`${base}/kurikulum`);
const levelInfo = await mlFetchRaw(`${base}/anak/sync-kurikulum/level`);
const sql = levelsSql(kurikulum, levelInfo);

const file = path.resolve(import.meta.dirname, "../supabase/migrations/004_ml_curriculum.sql");
const text = readFileSync(file, "utf8");
const begin = "-- BEGIN GENERATED levels";
const end = "-- END GENERATED levels";
const start = text.indexOf(begin);
const stop = text.indexOf(end);
if (start < 0 || stop < start) throw new Error("Penanda GENERATED tidak ada di 004_ml_curriculum.sql");

writeFileSync(file, `${text.slice(0, start + begin.length)}\n${sql}\n${text.slice(stop)}`);
console.log(`004_ml_curriculum.sql diisi: ${(kurikulum as { item: unknown[] }).item.length} item`);

/** Read-only connection check: `npm run check:db`. Prints counts, never the connection string. */
import { config } from "../src/config";
import { createPgDb } from "../src/db";

const db = createPgDb(config.DATABASE_URL);
const started = Date.now();
try {
  const { rows } = await db.query(`
    select current_database() as database,
           (select count(*)::int from public.levels)     as levels,
           (select count(*)::int from public.teachers)   as teachers,
           (select count(*)::int from public.classrooms) as classrooms,
           (select count(*)::int from public.students)   as students,
           (select count(*)::int from public.attempts)   as attempts,
           (select count(*)::int from public.homework)   as homework,
           (select count(*)::int from information_schema.columns
             where table_schema = 'public' and table_name = 'students' and column_name = 'parent_whatsapp') = 1 as migration_003,
           (select count(*)::int from information_schema.columns
             where table_schema = 'public' and table_name = 'attempts' and column_name = 'success') = 1 as migration_004,
           (select count(*)::int from public.rewards)    as rewards,
           (select count(*)::int from pg_proc where proname in ('record_attempt', 'redeem_reward')) as functions,
           (select count(*)::int from pg_tables where schemaname = 'public' and rowsecurity) as rls_tables`);
  console.log(`Terhubung ke Supabase (${Date.now() - started} ms)`);
  console.table(rows[0]);
} catch (error) {
  console.error("Gagal konek:", (error as Error).message);
  process.exitCode = 1;
} finally {
  await db.close();
}

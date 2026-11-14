/**
 * Runs record_attempt and redeem_reward on the REAL database inside a transaction that is rolled back,
 * so nothing is left behind:  npm run check:db:attempt
 */
import { config } from "../src/config";
import { createPgDb } from "../src/db";

const db = createPgDb(config.DATABASE_URL);
class Rollback extends Error {}

try {
  await db.tx(async (q) => {
    const { rows: classroom } = await q.query<{ id: string }>("select id from classrooms limit 1");
    if (!classroom[0]) throw new Error("Belum ada kelas (jalankan seed)");
    const { rows: student } = await q.query<{ id: string }>(
      "insert into students (classroom_id, nickname, picture_password_hash) values ($1, 'cek', 'x') returning id",
      [classroom[0].id],
    );
    const id = student[0].id;
    const play = async (item: string, success: boolean, stars: number) =>
      (
        await q.query(
          "select record_attempt($1, 'level-1', $2, $3, 1, 1500, 80, $4, 'school', null, 3) as r",
          [id, item, success, stars],
        )
      ).rows[0].r;

    console.log("2 bintang  t1-a:", await play("t1-a", true, 2));
    console.log("3 bintang  t1-a:", await play("t1-a", true, 3));
    console.log("gagal      t1-a:", await play("t1-a", false, 1));
    console.log("gagal      t1-i:", await play("t1-i", false, 1));

    const { rows: counts } = await q.query(
      "select (select count(*)::int from attempts where student_id = $1) attempts, (select count(*)::int from item_progress where student_id = $1) items, (select total_points from students where id = $1) points",
      [id],
    );
    console.log("hasil:", counts[0], "(harus attempts 4, items 2, points 70: 20+30+10+10)");
    throw new Rollback();
  });
} catch (error) {
  if (error instanceof Rollback) console.log("Di-rollback: tidak ada data yang tersimpan.");
  else {
    console.error("GAGAL:", (error as Error).message);
    process.exitCode = 1;
  }
} finally {
  await db.close();
}

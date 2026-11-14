import type { Db } from "./db";
import { hashPassword } from "./lib/security";

const DEFAULT_REWARDS: [name: string, costPoints: number, stock: number | null][] = [
  ["Stiker bintang", 30, null],
  ["Pensil warna", 100, 10],
  ["Buku gambar", 200, 5],
];

/** Creates a teacher with one classroom and a starter reward catalog. Returns the teacher id. */
export async function createTeacher(
  database: Db,
  input: { name: string; email: string; password: string; classroom: string },
): Promise<string> {
  const passwordHash = await hashPassword(input.password);
  return database.tx(async (q) => {
    const { rows } = await q.query<{ id: string }>(
      "insert into teachers (name, email, password_hash) values ($1, $2, $3) returning id",
      [input.name, input.email.trim().toLowerCase(), passwordHash],
    );
    const teacherId = rows[0].id;
    await q.query("insert into classrooms (teacher_id, name) values ($1, $2)", [teacherId, input.classroom]);
    for (const [name, cost, stock] of DEFAULT_REWARDS) {
      await q.query("insert into rewards (teacher_id, name, cost_points, stock) values ($1, $2, $3, $4)", [
        teacherId,
        name,
        cost,
        stock,
      ]);
    }
    return teacherId;
  });
}

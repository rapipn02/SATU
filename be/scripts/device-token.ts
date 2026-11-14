/**
 * Token untuk laptop kelas (web siswa): hanya boleh melihat daftar anak satu kelas dan login PIN mereka.
 *   npm run device-token -- --email guru@sekolah.id            (kelas pertama guru itu)
 *   npm run device-token -- --classroom <id-kelas>
 * Berlaku 90 hari. Taruh di VITE_DEVICE_TOKEN pada .env web siswa.
 */
import { config } from "../src/config";
import { createPgDb } from "../src/db";
import { signToken } from "../src/lib/security";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const db = createPgDb(config.DATABASE_URL, 2);
try {
  const { rows } = arg("classroom")
    ? await db.query<{ id: string; name: string }>("select id, name from classrooms where id = $1", [arg("classroom")])
    : await db.query<{ id: string; name: string }>(
        `select c.id, c.name from classrooms c join teachers t on t.id = c.teacher_id
          where t.email = $1 order by c.created_at limit 1`,
        [arg("email")?.toLowerCase()],
      );
  if (!rows[0]) throw new Error("Kelas tidak ditemukan. Pakai --email <email guru> atau --classroom <id>");
  console.error(`Kelas: ${rows[0].name} (${rows[0].id}), berlaku 90 hari`);
  console.log(signToken({ id: rows[0].id, role: "device" }));
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await db.close();
}

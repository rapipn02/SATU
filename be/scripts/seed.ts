/**
 * Creates a teacher account directly (there is no teacher sign-up page).
 *   npm run seed -- --name "Bu Rina" --email rina@sekolah.id --password "rahasia123" --class "Kelas 1"
 */
import { parseArgs } from "node:util";
import { config } from "../src/config";
import { createPgDb } from "../src/db";
import { createTeacher } from "../src/seed";

const { values } = parseArgs({
  options: {
    name: { type: "string", default: "Guru Demo" },
    email: { type: "string" },
    password: { type: "string" },
    class: { type: "string", default: "Kelas 1" },
  },
});
if (!values.email || !values.password || values.password.length < 8) {
  console.error('Pakai: npm run seed -- --email guru@sekolah.id --password "minimal8karakter" [--name ...] [--class ...]');
  process.exit(1);
}

const database = createPgDb(config.DATABASE_URL);
try {
  const id = await createTeacher(database, {
    name: values.name,
    email: values.email,
    password: values.password,
    classroom: values.class,
  });
  console.log(`Guru dibuat: ${values.email} (id ${id})`);
} finally {
  await database.close();
}

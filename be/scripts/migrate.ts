import { config } from "../src/config";
import { createPgDb } from "../src/db";
import { runMigrations } from "../src/migrate";

const database = createPgDb(config.DATABASE_URL);
try {
  await runMigrations(database, console.log);
  console.log("Migrasi selesai");
} finally {
  await database.close();
}

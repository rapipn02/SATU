import { createApp } from "./app";
import { config } from "./config";
import { createPgDb, setDb } from "./db";

setDb(createPgDb(config.DATABASE_URL, config.DB_POOL_MAX));

createApp().listen(config.PORT, () => {
  console.log(`SATU API jalan di http://localhost:${config.PORT}  (dokumentasi: /docs)`);
});

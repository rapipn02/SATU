// Runs before any test file imports the app, so src/config.ts reads these values.
import { afterAll, beforeEach } from "vitest";
import { fakeMl } from "./fake-ml";

process.env.DATABASE_URL = "postgres://unused-in-tests";
process.env.JWT_SECRET = "test-secret-key-with-at-least-32-characters";
process.env.PASSWORD_BCRYPT_ROUNDS = "4";
process.env.PICTURE_BCRYPT_ROUNDS = "4";
process.env.WEB_URL = "https://satu.test";
process.env.INVITE_URL = "";
process.env.AI_TIMEOUT_MS = "1500";
process.env.AI_LLM_TIMEOUT_MS = "1500";

// The ML service is faked (answers recorded from the real one); this also sets AI_URL.
await fakeMl.start();

beforeEach(() => fakeMl.reset());
afterAll(() => fakeMl.stop());

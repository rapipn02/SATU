import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const schema = z.object({
  DATABASE_URL: z.string().min(1, "Isi DATABASE_URL (Supabase > Connect > Session pooler)"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET minimal 32 karakter"),
  PORT: z.coerce.number().int().default(3000),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  WEB_URL: z.string().default("http://localhost:5173"),
  // Base of the parent invite link sent over WhatsApp. Set it to the parent mobile app's deep link
  // (e.g. "satu://undangan" or "https://satu.app/undangan"); the token is appended as the last path segment.
  INVITE_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  // Alamat publik backend (tanpa /api), dipakai untuk URL video tutorial. Kosong = URL relatif (/tutorial/...).
  PUBLIC_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  // The ML teammate's service, including its prefix: http://127.0.0.1:8000/ai. Empty = rule-based fallback only.
  AI_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  AI_TIMEOUT_MS: z.coerce.number().int().min(100).default(5000),
  // Endpoints that call the LLM (reports, suggestions, questions) are slower.
  AI_LLM_TIMEOUT_MS: z.coerce.number().int().min(100).default(20000),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10), // per proses; di cluster bagi batas pooler Supabase
  STREAK_MIN_PRACTICES: z.coerce.number().int().min(1).default(3),
  MAX_LOGIN_FAILURES: z.coerce.number().int().min(1).default(5),
  PASSWORD_BCRYPT_ROUNDS: z.coerce.number().int().min(4).default(10),
  // A picture password has only 9^3 = 729 combinations; the lockout protects it, not a slow hash.
  PICTURE_BCRYPT_ROUNDS: z.coerce.number().int().min(4).default(6),
});

export const config = schema.parse(process.env);

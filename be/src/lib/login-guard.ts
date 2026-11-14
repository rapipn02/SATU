import { AppError } from "./errors";

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

// ponytail: in-memory, per process. Resets on restart and is not shared between instances;
// move to a DB table or Redis if the API ever runs on more than one instance.
const failures = new Map<string, { count: number; since: number }>();

/** Throws 429 after too many failed logins for this key (e.g. "teacher:email") within 15 minutes. */
export function assertNotThrottled(key: string): void {
  const entry = failures.get(key);
  if (!entry) return;
  if (Date.now() - entry.since > WINDOW_MS) {
    failures.delete(key);
    return;
  }
  if (entry.count >= MAX_FAILURES) {
    throw new AppError(429, "Terlalu banyak percobaan login. Coba lagi 15 menit lagi.");
  }
}

export function recordFailure(key: string): void {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.since > WINDOW_MS) failures.set(key, { count: 1, since: Date.now() });
  else entry.count += 1;
}

export function clearFailures(key: string): void {
  failures.delete(key);
}

const ASK_MAX = 30;
const ASK_WINDOW_MS = 60 * 60 * 1000;
// ponytail: same in-memory caveat as above; with pm2 cluster x4 the real cap is up to 4x ASK_MAX.
const asked = new Map<string, number[]>();

/** Each question costs an LLM call: at most ASK_MAX per user per hour, then 429. */
export function assertAskQuota(userId: string): void {
  const now = Date.now();
  const recent = (asked.get(userId) ?? []).filter((t) => now - t < ASK_WINDOW_MS);
  if (recent.length >= ASK_MAX) {
    throw new AppError(429, "Sudah banyak pertanyaan dalam satu jam terakhir. Coba tanya lagi nanti, ya.");
  }
  recent.push(now);
  asked.set(userId, recent);
}

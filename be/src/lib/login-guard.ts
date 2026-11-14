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

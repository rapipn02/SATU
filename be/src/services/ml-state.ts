/**
 * Keeps the ML service in step with Supabase: starts sessions, forwards attempts, and rebuilds a
 * child's state when the ML service lost it.
 *
 * ponytail: the ML service keeps each child's BKT state in memory (PenyimpananMemori), so a restart
 * wipes it. When /level shows a blank child who has attempts in Supabase, we replay the last 200
 * attempts. Timestamps are "now" on replay (forgetting curves restart) and only the last 200 are
 * replayed. Remove this once the ML service stores state in the database.
 */

import { z } from "zod";
import { db } from "../db";
import { childPath, ml, mlAttemptSchema, mlLevelSchema, mlSessionSchema } from "../lib/ml-client";

export type MlLevels = z.infer<typeof mlLevelSchema>;

export interface AttemptForMl {
  itemId: string;
  success: boolean;
  stepsReached: number;
  durationMs: number | null;
}

const REPLAY_LIMIT = 200;
const replaying = new Map<string, Promise<boolean>>();

const toBody = (a: AttemptForMl) => ({
  item_id: a.itemId,
  berhasil: a.success,
  langkah_tercapai: a.stepsReached,
  ...(a.durationMs === null ? {} : { durasi_ms: a.durationMs }),
});

/** Tells the ML service a new practice session started (resets its fatigue and streak-in-session counters). */
export function startMlSession(studentId: string): void {
  void ml("POST", childPath(studentId, "/sesi"), mlSessionSchema);
}

export function forwardAttempt(studentId: string, attempt: AttemptForMl) {
  return ml("POST", childPath(studentId, "/percobaan"), mlAttemptSchema, { body: toBody(attempt) });
}

/** Face model saved with the child (from the Mata component), mirrored to the ML service. */
export function pushLipModel(studentId: string, model: unknown): void {
  void ml("PUT", childPath(studentId, "/model-bibir"), z.looseObject({ tersimpan: z.boolean() }), { body: { model } });
}

const isBlank = (levels: MlLevels) => levels.level.every((l) => l.kemajuan === 0);

async function replay(studentId: string): Promise<boolean> {
  const { rows } = await db().query<AttemptForMl & { createdAt: string }>(
    `select item as "itemId", success, steps_reached as "stepsReached", duration_ms as "durationMs", created_at as "createdAt"
       from (select * from attempts where student_id = $1 order by created_at desc limit ${REPLAY_LIMIT}) recent
      order by created_at asc`,
    [studentId],
  );
  if (!rows.length) return false;
  for (const attempt of rows) {
    if (!(await forwardAttempt(studentId, attempt))) return false; // ML went away again; try next time
  }
  const { rows: student } = await db().query<{ calibration: unknown }>(
    "select calibration from students where id = $1",
    [studentId],
  );
  if (student[0]?.calibration) pushLipModel(studentId, student[0].calibration);
  return true;
}

/**
 * The child's level map from the ML service, or null when it is unavailable.
 * A blank answer for a child who has practised means the ML service restarted: restore, then ask again.
 */
export async function mlLevels(studentId: string): Promise<MlLevels | null> {
  const path = childPath(studentId, "/level");
  const first = await ml("GET", path, mlLevelSchema);
  if (!first || !isBlank(first)) return first;

  let job = replaying.get(studentId);
  if (!job) {
    job = replay(studentId).finally(() => replaying.delete(studentId));
    replaying.set(studentId, job);
  }
  return (await job) ? ml("GET", path, mlLevelSchema) : first;
}

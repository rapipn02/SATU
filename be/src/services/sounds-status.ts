/** Which sounds a child can already do: from the ML map, or from item_progress when ML is unavailable. */

import { db } from "../db";
import { childPath, ml, mlMapSchema } from "../lib/ml-client";
import { soundName } from "../lib/sounds";
import { mlLevels } from "./ml-state";

export const SOUNDS = ["a", "i", "u", "e", "o", "M", "F", "H", "S", "T"] as const;
export type SoundStatus = "sudah_bisa" | "hampir_bisa" | "sedang_dilatih" | "belum_dilatih";

const RANK: Record<SoundStatus, number> = { belum_dilatih: 0, sedang_dilatih: 1, hampir_bisa: 2, sudah_bisa: 3 };

export async function soundStatus(studentId: string) {
  await mlLevels(studentId); // restores ML state first if that service restarted
  const map = await ml("GET", childPath(studentId, "/peta"), mlMapSchema);

  const status = Object.fromEntries(SOUNDS.map((s) => [s, "belum_dilatih"])) as Record<string, SoundStatus>;
  if (map) {
    for (const { bunyi, label } of map.bunyi) if (bunyi in status) status[bunyi] = label as SoundStatus;
  } else {
    const { rows } = await db().query<{ item_id: string; best_stars: number }>(
      "select item_id, best_stars from item_progress where student_id = $1",
      [studentId],
    );
    for (const { item_id, best_stars } of rows) {
      const [, tier, sound] = /^t(\d+)-(.+)$/.exec(item_id) ?? [];
      if (!sound || !(sound in status)) continue;
      const got: SoundStatus =
        tier === "2" && best_stars >= 2 ? "sudah_bisa" : tier === "1" && best_stars >= 2 ? "hampir_bisa" : "sedang_dilatih";
      if (RANK[got] > RANK[status[sound]]) status[sound] = got;
    }
  }

  const cleared = Object.fromEntries(SOUNDS.map((s) => [s, status[s] === "sudah_bisa"]));
  return {
    status,
    cleared,
    canDo: SOUNDS.filter((s) => cleared[s]).map((s) => `Bunyi ${soundName(s)}`),
    source: map ? ("ai" as const) : ("fallback" as const),
  };
}

/** Sounds table for a whole classroom (the "Kelas" screen). */
export async function classSounds(classroomId: string) {
  const { rows } = await db().query<{ id: string; nickname: string; photoUrl: string | null }>(
    `select id, nickname, photo_url as "photoUrl" from students where classroom_id = $1 order by nickname`,
    [classroomId],
  );
  const students = await Promise.all(rows.map(async (s) => ({ ...s, ...(await soundStatus(s.id)) })));
  return { sounds: [...SOUNDS], students };
}

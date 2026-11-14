/** Adventure map (curriculum owned by the ML service), attempts, streak and student profile. */

import { config } from "../config";
import { db, TODAY_WIB } from "../db";
import { badRequest, notFound } from "../lib/errors";
import type { MlItem, MlNext } from "../lib/ml-client";
import { isCorrect, starsFor } from "../lib/stars";
import { tutorialUrl } from "../lib/tutorial";
import type { Principal } from "../lib/security";
import { forwardAttempt, mlLevels, pushLipModel } from "./ml-state";

export interface LevelItem {
  id: string; // ML item id, e.g. "t1-a", "t3-ma", "t4-bola"
  text: string;
  tingkat: number; // 1 sound with help, 2 sound, 3 syllable, 4 word
  urutan: string[]; // shapes the child must make, in order
  bantuanVisual: boolean;
  dinilaiSebagian: boolean; // tongue sounds: only mouth and voice are judged
}

export interface Level {
  id: string; // "level-1" .. "level-6"
  category: "vokal" | "konsonan" | "suku_kata" | "kata";
  orderNo: number;
  title: string;
  items: LevelItem[];
  unlockAfterLevelId: string | null;
}

export async function allLevels(): Promise<Level[]> {
  const { rows } = await db().query<Level>(
    `select id, category, order_no as "orderNo", title, items, unlock_after_level_id as "unlockAfterLevelId"
       from levels order by order_no`,
  );
  return rows;
}

export const toItem = (item: MlItem): LevelItem => ({
  id: item.id,
  text: item.teks,
  tingkat: item.tingkat,
  urutan: item.urutan,
  bantuanVisual: item.bantuan_visual,
  dinilaiSebagian: item.dinilai_sebagian,
});

async function itemStars(studentId: string): Promise<Map<string, number>> {
  const { rows } = await db().query<{ itemId: string; bestStars: number }>(
    `select item_id as "itemId", best_stars as "bestStars" from item_progress where student_id = $1`,
    [studentId],
  );
  return new Map(rows.map((r) => [r.itemId, r.bestStars]));
}

async function levelProgress(studentId: string): Promise<Map<string, { bestStars: number; attempts: number }>> {
  const { rows } = await db().query<{ levelId: string; bestStars: number; attempts: number }>(
    `select level_id as "levelId", best_stars as "bestStars", attempts from level_progress where student_id = $1`,
    [studentId],
  );
  return new Map(rows.map((r) => [r.levelId, { bestStars: r.bestStars, attempts: r.attempts }]));
}

export type LevelStatus = "tuntas" | "terbuka" | "terkunci";

/**
 * Level map: a level opens once the one before it has at least one star (the teacher can override
 * with a level cap). The ML service still suggests the next item and writes the reports.
 */
export async function adventureMap(studentId: string) {
  const [levels, stars, progress, cap] = await Promise.all([
    allLevels(),
    itemStars(studentId),
    levelProgress(studentId),
    db().query<{ maxLevel: number | null }>(`select max_level as "maxLevel" from students where id = $1`, [studentId]),
    // Still called so the ML service gets its state restored if it restarted (used by the AI
    // features and the next-item suggestion); its level status is no longer used for the map.
    mlLevels(studentId),
  ]);
  const maxLevel = cap.rows[0]?.maxLevel ?? null; // set by the teacher; null = stars decide

  return levels.map((level) => {
    const local = progress.get(level.id);
    const localBest = local?.bestStars ?? 0;
    const unlockedByRule =
      !level.unlockAfterLevelId || (progress.get(level.unlockAfterLevelId)?.bestStars ?? 0) >= 1;
    // ponytail: hackathon rule, stars only (the ML mastery-based unlock is switched off).
    const natural: LevelStatus = localBest >= 3
        ? "tuntas"
        : unlockedByRule
          ? "terbuka"
          : "terkunci";
    // The teacher's limit wins both ways: levels up to it are open, levels above it are locked.
    const status: LevelStatus =
      maxLevel === null ? natural : level.orderNo <= maxLevel ? (natural === "tuntas" ? "tuntas" : "terbuka") : "terkunci";
    return {
      ...level,
      items: level.items.map((item) => ({ ...item, bestStars: stars.get(item.id) ?? 0, tutorialUrl: tutorialUrl(item.id) })),
      bestStars: localBest, // level stars 0-3 (best attempt in this level)
      progress: localBest / 3, // 0-1
      attempts: local?.attempts ?? 0,
      status,
      lockedByTeacher: maxLevel !== null && level.orderNo > maxLevel,
      unlocked: status !== "terkunci",
      source: "stars" as const,
    };
  });
}

type MapLevel = Awaited<ReturnType<typeof adventureMap>>[number];

/** Next item without the ML service: the least-practised item in the first open level that is not finished. */
function fallbackNext(map: MapLevel[]) {
  const open = map.filter((l) => l.unlocked);
  const level = open.find((l) => l.items.some((i) => i.bestStars < 3)) ?? open[open.length - 1] ?? map[0];
  const item = [...level.items].sort((a, b) => a.bestStars - b.bestStars)[0];
  return {
    item: { id: item.id, text: item.text, tingkat: item.tingkat, urutan: item.urutan, bantuanVisual: item.bantuanVisual, dinilaiSebagian: item.dinilaiSebagian },
    levelId: level.id,
    reason: "fallback",
    expectedSuccess: null as number | null,
    rest: false,
  };
}

export const normalizeNext = (next: MlNext) => ({
  item: toItem(next.item),
  levelId: `level-${next.item.level}`,
  reason: next.alasan,
  expectedSuccess: next.perkiraan_berhasil as number | null,
  rest: next.istirahat,
});

export interface AttemptInput {
  itemId: string;
  berhasil: boolean;
  langkah_tercapai: number;
  durasi_ms?: number;
  kemiripan: number;
  homeworkItemId?: string;
}

export async function submitAttempt(student: Principal, input: AttemptInput) {
  const levels = await allLevels();
  const level = levels.find((l) => l.items.some((i) => i.id === input.itemId));
  if (!level) throw badRequest("Item latihan tidak dikenal");

  // The child practises from the map without knowing about homework: count the attempt for the oldest
  // open homework item with this exercise, so homework given by the teacher can still be completed.
  const homeworkItemId =
    input.homeworkItemId ??
    (
      await db().query<{ id: string }>(
        `select hi.id from homework_items hi join homework h on h.id = hi.homework_id
          where h.student_id = $1 and h.status = 'assigned' and hi.item = $2 and hi.completed_at is null
          order by h.created_at, hi.position limit 1`,
        [student.id, input.itemId],
      )
    ).rows[0]?.id;

  // Free play must follow the map; homework may target any level the teacher chose.
  // (Also restores the ML state first when that service lost it, before this attempt is added.)
  const map = await adventureMap(student.id);
  if (!homeworkItemId && !map.find((l) => l.id === level.id)?.unlocked) {
    throw badRequest("Level masih terkunci");
  }

  const correct = isCorrect(input.berhasil, input.kemiripan); // reached the target with accuracy >= 50%
  const stars = starsFor(input.berhasil, input.kemiripan);
  const { rows } = await db().query<{ result: Record<string, number | boolean> }>(
    "select record_attempt($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) as result",
    [
      student.id,
      level.id,
      input.itemId,
      correct,
      input.langkah_tercapai,
      input.durasi_ms ?? null,
      Math.round(input.kemiripan * 10000) / 100,
      stars,
      student.src ?? "school",
      homeworkItemId ?? null,
      config.STREAK_MIN_PRACTICES,
    ],
  );
  const r = rows[0].result;

  const ai = await forwardAttempt(student.id, {
    itemId: input.itemId,
    success: correct,
    stepsReached: input.langkah_tercapai,
    durationMs: input.durasi_ms ?? null,
  });

  // Never send the child to a level the teacher has locked, even if the AI proposes one.
  const after = await adventureMap(student.id);
  const aiNext = ai ? normalizeNext(ai.berikutnya) : null;
  const aiAllowed = aiNext ? after.find((l) => l.id === aiNext.levelId)?.unlocked !== false : false;
  const next = aiNext && aiAllowed ? aiNext : fallbackNext(after);

  return {
    itemId: input.itemId,
    levelId: level.id,
    stars,
    correct,
    accuracy: Math.round(input.kemiripan * 100),
    bestStars: r.best_stars, // best for this item
    pointsEarned: r.points_earned,
    totalPoints: r.total_points,
    dailyCount: r.daily_count,
    dailyTarget: config.STREAK_MIN_PRACTICES,
    streak: { current: r.streak_current, longest: r.streak_longest },
    homeworkDone: r.homework_done,
    mastery: ai?.perubahan ?? [],
    rest: { suggested: ai?.lelah.lelah ?? false, reasons: ai?.lelah.alasan ?? [] },
    next, // from the AI; from the map when the AI is down or proposed a locked level
    source: ai && aiAllowed ? ("ai" as const) : ("fallback" as const),
  };
}

/** Streak as shown to people: a streak whose last active day is older than yesterday counts as broken (0). */
export async function streakOf(studentId: string) {
  const { rows } = await db().query<{ current: number; longest: number; lastActiveDay: string | null }>(
    `select case when s.last_active_day >= ${TODAY_WIB} - 1 then s.current else 0 end as current,
            coalesce(s.longest, 0) as longest,
            s.last_active_day as "lastActiveDay"
       from (select $1::uuid as id) x left join streaks s on s.student_id = x.id`,
    [studentId],
  );
  const { rows: days } = await db().query<{ day: string; count: number }>(
    `select d::date::text as day, coalesce(a.practice_count, 0) as count
       from generate_series(${TODAY_WIB} - 6, ${TODAY_WIB}, interval '1 day') d
       left join daily_activity a on a.student_id = $1 and a.day = d::date
      order by d`,
    [studentId],
  );
  const target = config.STREAK_MIN_PRACTICES;
  return {
    current: rows[0].current ?? 0,
    longest: rows[0].longest,
    lastActiveDay: rows[0].lastActiveDay,
    dailyTarget: target,
    todayCount: days[days.length - 1].count,
    last7Days: days.map((d) => ({ ...d, active: d.count >= target })),
  };
}

export async function studentProfile(studentId: string) {
  const { rows } = await db().query(
    `select s.id, s.nickname, s.photo_url as "photoUrl", s.total_points as "totalPoints",
            s.calibration, c.name as "classroomName"
       from students s join classrooms c on c.id = s.classroom_id where s.id = $1`,
    [studentId],
  );
  if (!rows[0]) throw notFound("Siswa tidak ditemukan");
  return { ...rows[0], streak: await streakOf(studentId) };
}

/** Lip model from the Mata component; kept with the child so it follows them to another device. */
export async function saveCalibration(studentId: string, model: unknown) {
  await db().query("update students set calibration = $2 where id = $1", [studentId, JSON.stringify(model)]);
  pushLipModel(studentId, model);
  return { saved: true };
}

export async function getCalibration(studentId: string) {
  const { rows } = await db().query<{ calibration: unknown }>("select calibration from students where id = $1", [studentId]);
  return { model: rows[0]?.calibration ?? null };
}

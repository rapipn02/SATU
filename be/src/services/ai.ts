/**
 * AI features for teachers and parents, built on the ML teammate's service (see lib/ml-client.ts).
 * Each function returns the ML answer with `source: "ai"`, or a rule-based answer with
 * `source: "fallback"` when the service is not configured, down, or slow, so the apps never break.
 */

import { db } from "../db";
import type { z } from "zod";
import {
  childPath, ml, mlAdviceSchema, mlAskSchema, mlClassSchema, mlHistorySchema, mlMapSchema, mlReportSchema, mlTaskSchema,
} from "../lib/ml-client";
import { soundList } from "../lib/sounds";
import { classroomOf, ownedStudent } from "./accounts";
import { classOverview } from "./dashboard";
import { ITEM_PETA } from "../lib/peta";
import { assertItemsExist } from "./homework";
import { adventureMap } from "./practice";
import { mlLevels } from "./ml-state";

const SUGGESTION_SIZE = 3;
const STUCK_AFTER_ATTEMPTS = 3;

async function remember(classroomId: string, studentId: string | null, summary: string, issues: unknown) {
  await db().query(
    "insert into ai_insights (classroom_id, student_id, summary, issues) values ($1, $2, $3, $4)",
    [classroomId, studentId, summary, JSON.stringify(issues)],
  );
}

// ------------------------------------------------------------------ per child (teacher)

export async function studentInsight(teacherId: string, studentId: string) {
  const [classroom, student] = await Promise.all([classroomOf(teacherId), ownedStudent(teacherId, studentId)]);
  await mlLevels(studentId); // restores the ML state first if that service restarted
  const [map, advice] = await Promise.all([
    ml("GET", childPath(studentId, "/peta"), mlMapSchema),
    ml("POST", childPath(studentId, "/saran-belajar"), mlAdviceSchema, { body: { nama: student.nickname }, llm: true }),
  ]);

  let result;
  if (map) {
    const current = map.level.level.find((l) => l.level === map.level.level_sekarang);
    const stuck = map.insight.macet.map((m) => m.bunyi);
    const rising = map.insight.naik.map((n) => n.bunyi);
    result = {
      summary:
        `${student.nickname} sedang di level ${map.level.level_sekarang}${current ? ` (${current.nama})` : ""}. ` +
        (stuck.length ? `Perlu perhatian: ${soundList(stuck)}. ` : "Belum ada bunyi yang macet. ") +
        (rising.length ? `Baru naik minggu ini: ${soundList(rising)}.` : ""),
      level: current?.nama ?? `Level ${map.level.level_sekarang}`,
      issues: map.insight.macet.map((m) => ({
        item: soundList([m.bunyi]),
        problem: `Sudah ${(m as { percobaan?: number }).percobaan ?? "beberapa"} kali dicoba dan penguasaan masih di bawah 50%`,
      })),
      sounds: map.bunyi, // per sound: label (sudah_bisa / hampir_bisa / sedang_dilatih / belum_dilatih)
      focus: advice?.fokus ?? [],
      advice: advice?.saran.map((s) => s.teks) ?? [],
      adviceWriter: advice?.sumber ?? null, // "llm" or "templat"
      source: "ai" as const,
    };
  } else {
    const levels = await adventureMap(studentId);
    const current = levels.find((l) => l.unlocked && l.bestStars < 3) ?? levels[levels.length - 1];
    result = {
      summary:
        `${student.nickname} sudah menyelesaikan ${levels.filter((l) => l.bestStars >= 1).length} ` +
        `dari ${levels.length} level. Sedang berlatih: ${current.title}.`,
      level: current.title,
      issues: levels
        .filter((l) => l.attempts >= STUCK_AFTER_ATTEMPTS && l.bestStars <= 1)
        .map((l) => ({ item: l.title, problem: `Sudah ${l.attempts} kali mencoba, bintang terbaik ${l.bestStars}` })),
      sounds: [],
      focus: [],
      advice: [],
      adviceWriter: null,
      source: "fallback" as const,
    };
  }
  await remember(classroom.id, studentId, result.summary, result.issues);
  return result;
}

export async function suggestHomework(teacherId: string, studentId: string) {
  const student = await ownedStudent(teacherId, studentId);
  await mlLevels(studentId);

  const [ai, levels] = await Promise.all([
    ml("POST", childPath(studentId, "/tugas-usulan"), mlTaskSchema, { body: { nama: student.nickname }, llm: true }),
    adventureMap(studentId),
  ]);

  // Hackathon rule (stars only): never suggest an exercise the child already finished with 3 stars,
  // nor one in a level that is still locked for this child.
  const stars = new Map(levels.flatMap((l) => l.items.map((i) => [i.id, i.bestStars] as const)));
  const open = new Set(levels.filter((l) => l.unlocked).map((l) => l.id));
  const fits = (levelId: string, itemId: string) => open.has(levelId) && (stars.get(itemId) ?? 0) < 3;

  let fromAi: { levelId: string; item: string; text: string; reason: string }[] = [];
  if (ai?.tugas.length) {
    const items = ai.tugas.map((t) => ({ levelId: `level-${t.item.level}`, item: t.item.id, text: t.item.teks, reason: t.alasan }));
    try {
      await assertItemsExist(items);
      fromAi = items.filter((i) => fits(i.levelId, i.item));
    } catch {
      // the ML service proposed an item outside the stored curriculum; use the rule below instead
    }
  }

  // Fill up with the rule: exercises on the map first, then fewest stars, earliest level, page order.
  const chosen = new Set(fromAi.map((i) => i.item));
  const onMap = (id: string) => (ITEM_PETA.includes(id) ? ITEM_PETA.indexOf(id) : Number.MAX_SAFE_INTEGER);
  const ranked = levels
    .filter((l) => l.unlocked)
    .flatMap((level) => level.items.map((item, index) => ({ level, item, index })))
    .filter(({ level, item }) => fits(level.id, item.id) && !chosen.has(item.id))
    .sort(
      (a, b) =>
        Number(onMap(a.item.id) === Number.MAX_SAFE_INTEGER) - Number(onMap(b.item.id) === Number.MAX_SAFE_INTEGER) ||
        a.item.bestStars - b.item.bestStars ||
        a.level.orderNo - b.level.orderNo ||
        onMap(a.item.id) - onMap(b.item.id) ||
        a.index - b.index,
    );
  const fromRule = ranked.slice(0, Math.max(0, SUGGESTION_SIZE - fromAi.length)).map(({ level, item }) => ({
    levelId: level.id,
    item: item.id,
    text: item.text,
    reason: item.bestStars === 0 ? "Belum pernah dicoba" : `Bintang terbaik ${item.bestStars} dari 3`,
  }));

  return {
    items: [...fromAi, ...fromRule],
    writer: fromAi.length ? (ai?.sumber ?? null) : null,
    source: fromAi.length ? ("ai" as const) : ("fallback" as const),
  };
}

export async function studentHistory(teacherId: string, studentId: string) {
  await ownedStudent(teacherId, studentId);
  await mlLevels(studentId);
  const ai = await ml("GET", childPath(studentId, "/riwayat"), mlHistorySchema);
  const day = (date: string, attempts: number, successes: number) => ({
    date,
    attempts,
    successes,
    rate: attempts ? Math.round((successes / attempts) * 100) : 0,
  });
  if (ai) {
    const daily = ai.harian.map((h) => {
      const d = h as { tanggal: string; percobaan?: number; berhasil?: number };
      return day(d.tanggal, d.percobaan ?? 0, d.berhasil ?? 0);
    });
    return { daily, perSound: (ai as { per_bunyi?: unknown }).per_bunyi ?? {}, source: "ai" as const };
  }

  const { rows } = await db().query<{ date: string; attempts: number; successes: number }>(
    `select (created_at at time zone 'Asia/Jakarta')::date::text as date, count(*)::int as attempts,
            (count(*) filter (where success))::int as successes
       from attempts where student_id = $1 group by 1 order by 1 desc limit 60`,
    [studentId],
  );
  return { daily: rows.reverse().map((r) => day(r.date, r.attempts, r.successes)), perSound: {}, source: "fallback" as const };
}

/** AI-proposed homework for every child in a classroom (teacher approves with POST /homework/batch). */
export async function classSuggestedHomework(teacherId: string, classroomId?: string) {
  const classroom = await classroomOf(teacherId, classroomId);
  const { rows } = await db().query<{ id: string; nickname: string; photoUrl: string | null }>(
    `select id, nickname, photo_url as "photoUrl" from students where classroom_id = $1 order by nickname`,
    [classroom.id],
  );
  return Promise.all(
    rows.map(async (student) => ({ student, ...(await suggestHomework(teacherId, student.id)) })),
  );
}

// ------------------------------------------------------------------ class (teacher)

export async function classInsight(teacherId: string, classroomId?: string) {
  const overview = await classOverview(teacherId, classroomId);
  const ai = overview.students.length
    ? await ml("POST", "/kelas/ringkasan", mlClassSchema, {
        body: { anak: overview.students.map((s) => ({ anak_id: s.id, nama: s.nickname })) },
        llm: true,
      })
    : null;

  const issues = overview.students
    .filter((s) => s.streak === 0)
    .map((s) => ({ item: s.nickname, problem: "Belum berlatih rutin (streak putus)" }));
  const result = ai
    ? { summary: ai.ringkasan, issues, writer: ai.sumber, source: "ai" as const }
    : {
        summary:
          `${overview.totals.practisedToday} dari ${overview.totals.students} anak sudah berlatih hari ini. ` +
          `Rata-rata bintang ${overview.totals.averageStars}.`,
        issues,
        writer: null,
        source: "fallback" as const,
      };
  await remember(overview.classroom.id, null, result.summary, result.issues);
  return result;
}

// ------------------------------------------------------------------ questions and reports

type Reader = "guru" | "orang_tua";

export async function askAboutChild(
  child: { id: string; nickname: string },
  question: string,
  reader: Reader,
) {
  await mlLevels(child.id);
  const ai = await ml("POST", childPath(child.id, "/tanya"), mlAskSchema, {
    body: { nama: child.nickname, pertanyaan: question, pembaca: reader },
    llm: true,
  });
  if (ai) {
    return {
      answer: ai.jawaban,
      references: (ai as { rujukan?: unknown }).rujukan ?? [],
      writer: ai.sumber,
      source: "ai" as const,
    };
  }
  return {
    answer: "Layanan AI sedang tidak tersedia. Coba lagi sebentar lagi, atau lihat progres anak di halaman progres.",
    references: [],
    writer: null,
    source: "fallback" as const,
  };
}

const HELP_TIP = "Duduk berhadapan di tempat terang supaya anak bisa melihat bibir Anda dengan jelas, lalu latihan sebentar tapi rutin.";

/** Weekly report for a parent. */
export async function weeklyReport(child: { id: string; nickname: string }) {
  await mlLevels(child.id);
  const ai = await ml("POST", childPath(child.id, "/laporan-mingguan"), mlReportSchema, {
    body: { nama: child.nickname },
    llm: true,
  });
  if (ai) {
    const r = ai as z.infer<typeof mlReportSchema> & Record<string, unknown>;
    return {
      achieved: r.sudah_bisa,
      practising: r.sedang_dilatih,
      howToHelp: r.cara_membantu,
      practiceDays: r.hari_latihan,
      references: r.rujukan ?? [],
      writer: ai.sumber,
      source: "ai" as const,
    };
  }

  const { rows } = await db().query<{ total: number; school: number; home: number; days: number }>(
    `select count(*)::int as total,
            (count(*) filter (where source = 'school'))::int as school,
            (count(*) filter (where source = 'home'))::int as home,
            count(distinct (created_at at time zone 'Asia/Jakarta')::date)::int as days
       from attempts where student_id = $1 and created_at >= now() - interval '7 days'`,
    [child.id],
  );
  const week = rows[0];
  const levels = await adventureMap(child.id);
  const current = levels.find((l) => l.unlocked && l.bestStars < 3) ?? levels[levels.length - 1];
  return {
    achieved: `${child.nickname} berlatih ${week.total} kali minggu ini (${week.school} di sekolah, ${week.home} di rumah).`,
    practising: `Sedang berlatih: ${current.title}.`,
    howToHelp: HELP_TIP,
    practiceDays: week.days,
    references: [],
    writer: null,
    source: "fallback" as const,
  };
}

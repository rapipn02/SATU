/** Teacher monitoring: whole-class overview and one child's detail. */

import { db, TODAY_WIB } from "../db";
import { classroomOf, ownedStudent } from "./accounts";
import { homeworkForStudent } from "./homework";
import { adventureMap, streakOf } from "./practice";
import { classSounds, soundStatus } from "./sounds-status";

export async function classSoundTable(teacherId: string, classroomId?: string) {
  const classroom = await classroomOf(teacherId, classroomId);
  return { classroom, ...(await classSounds(classroom.id)) };
}

export async function classOverview(teacherId: string, classroomId?: string) {
  const classroom = await classroomOf(teacherId, classroomId);
  const { rows: students } = await db().query<{
    id: string;
    nickname: string;
    todayCount: number;
    streak: number;
    avgStars: number;
    levelsDone: number;
  }>(
    `select s.id, s.nickname, s.photo_url as "photoUrl", s.is_locked as "isLocked", s.total_points as "totalPoints",
            coalesce(da.practice_count, 0) as "todayCount",
            case when st.last_active_day >= ${TODAY_WIB} - 1 then st.current else 0 end as streak,
            coalesce(lp.levels_done, 0)::int as "levelsDone",
            coalesce(lp.avg_stars, 0)::float8 as "avgStars",
            la.last_at as "lastPracticeAt",
            coalesce(hw.open, 0)::int as "openHomework"
       from students s
       left join daily_activity da on da.student_id = s.id and da.day = ${TODAY_WIB}
       left join streaks st on st.student_id = s.id
       left join (select student_id, count(*) filter (where best_stars >= 1) as levels_done, avg(best_stars) as avg_stars
                    from level_progress group by student_id) lp on lp.student_id = s.id
       left join (select student_id, max(created_at) as last_at from attempts group by student_id) la
              on la.student_id = s.id
       left join (select student_id, count(*) as open from homework where status = 'assigned' group by student_id) hw
              on hw.student_id = s.id
      where s.classroom_id = $1
      order by s.nickname`,
    [classroom.id],
  );

  const practisedToday = students.filter((s) => s.todayCount > 0).length;
  const withProgress = students.filter((s) => s.levelsDone > 0);
  return {
    classroom,
    totals: {
      students: students.length,
      practisedToday,
      practicesToday: students.reduce((sum, s) => sum + s.todayCount, 0),
      averageStars: withProgress.length
        ? Number((withProgress.reduce((sum, s) => sum + s.avgStars, 0) / withProgress.length).toFixed(2))
        : 0,
      brokenStreaks: students.filter((s) => s.streak === 0).length,
    },
    students: students.map((s) => ({ ...s, avgStars: Number(s.avgStars.toFixed(2)) })),
  };
}

export async function studentDetail(teacherId: string, studentId: string) {
  const student = await ownedStudent(teacherId, studentId);
  const [sounds, days, levels, streak, homework, recent] = await Promise.all([
    soundStatus(studentId),
    db().query<{ days: number }>(
      `select count(distinct (created_at at time zone 'Asia/Jakarta')::date)::int as days
         from attempts where student_id = $1 and created_at >= now() - interval '7 days'`,
      [studentId],
    ),
    adventureMap(studentId),
    streakOf(studentId),
    homeworkForStudent(studentId),
    db().query(
      `select a.id, a.level_id as "levelId", l.title as "levelTitle", a.item,
              (select i->>'text' from jsonb_array_elements(l.items) i where i->>'id' = a.item) as "itemText",
              a.success, a.score, a.stars, a.source, a.created_at as "createdAt"
         from attempts a join levels l on l.id = a.level_id
        where a.student_id = $1 order by a.created_at desc limit 30`,
      [studentId],
    ),
  ]);
  const { rows: points } = await db().query<{ totalPoints: number; maxLevel: number | null }>(
    `select total_points as "totalPoints", max_level as "maxLevel" from students where id = $1`,
    [studentId],
  );
  return {
    student: { id: student.id, nickname: student.nickname, photoUrl: student.photoUrl, isLocked: student.isLocked, maxLevel: points[0].maxLevel },
    totalPoints: points[0].totalPoints,
    ...sounds, // status, cleared, canDo, source
    practiceDays7: days.rows[0].days,
    streak,
    levels,
    recentAttempts: recent.rows,
    homework,
  };
}

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/**
 * Daily learning chart, ready to draw: one entry per day for the last `days` days (WIB), days without
 * practice included as 0. Same rules as the map: correct = accuracy >= 50%, points = stars x 10.
 * Used by the teacher app and the parent app.
 */
export async function learningChart(studentId: string, days = 7) {
  const { rows } = await db().query<{
    date: string; attempts: number; correct: number; stars: number; accuracy: number; school: number; home: number;
  }>(
    `select d::date::text as date,
            count(a.id)::int as attempts,
            (count(a.id) filter (where a.success))::int as correct,
            coalesce(sum(a.stars), 0)::int as stars,
            coalesce(round(avg(a.score)), 0)::int as accuracy,
            (count(a.id) filter (where a.source = 'school'))::int as school,
            (count(a.id) filter (where a.source = 'home'))::int as home
       from generate_series(${TODAY_WIB} - ($2::int - 1), ${TODAY_WIB}, interval '1 day') d
       left join attempts a on a.student_id = $1 and (a.created_at at time zone 'Asia/Jakarta')::date = d::date
      group by d order by d`,
    [studentId, days],
  );
  const daily = rows.map((r) => {
    const t = new Date(`${r.date}T00:00:00Z`);
    return { ...r, points: r.stars * 10, label: `${HARI[t.getUTCDay()]} ${t.getUTCDate()}/${t.getUTCMonth() + 1}` };
  });
  const total = (k: "attempts" | "correct" | "points") => daily.reduce((n, d) => n + d[k], 0);
  const practised = daily.filter((d) => d.attempts > 0);
  return {
    days,
    // Arrays for chart libraries (MPAndroidChart, Vico, ...): same order as `labels`.
    labels: daily.map((d) => d.label),
    series: {
      attempts: daily.map((d) => d.attempts),
      correct: daily.map((d) => d.correct),
      accuracy: daily.map((d) => d.accuracy),
      points: daily.map((d) => d.points),
    },
    daily,
    summary: {
      practiceDays: practised.length,
      attempts: total("attempts"),
      correct: total("correct"),
      points: total("points"),
      accuracy: practised.length ? Math.round(practised.reduce((n, d) => n + d.accuracy * d.attempts, 0) / total("attempts")) : 0,
    },
  };
}

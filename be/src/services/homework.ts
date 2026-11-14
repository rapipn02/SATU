/** Homework (PR): teacher assigns items, the child practises at home, results flow back to the teacher. */

import { db, TODAY_WIB, type Queryable } from "../db";
import { badRequest } from "../lib/errors";
import { classroomOf, ownedStudent } from "./accounts";
import { tutorialUrl } from "../lib/tutorial";
import { allLevels } from "./practice";

export interface HomeworkItemInput {
  levelId: string;
  item: string;
  requiredStars?: number;
}

export async function assertItemsExist(items: HomeworkItemInput[]) {
  const levels = new Map((await allLevels()).map((l) => [l.id, l]));
  for (const item of items) {
    const level = levels.get(item.levelId);
    if (!level || !level.items.some((i) => i.id === item.item)) {
      throw badRequest(`Item "${item.item}" tidak ada di level ${item.levelId}`);
    }
  }
}

/** Homework rows with their items, each item carrying home-attempt count and best stars. */
async function loadHomework(where: string, params: unknown[]) {
  const { rows: homework } = await db().query<{ id: string }>(
    `select h.id, h.student_id as "studentId", s.nickname, h.due_date as "dueDate", h.note, h.status,
            h.created_at as "createdAt", h.completed_at as "completedAt"
       from homework h join students s on s.id = h.student_id
      where ${where}
      order by h.due_date desc, h.created_at desc`,
    params,
  );
  if (!homework.length) return [];
  const { rows: items } = await db().query<{ homeworkId: string; item: string }>(
    `select hi.id, hi.homework_id as "homeworkId", hi.position, hi.level_id as "levelId", l.title as "levelTitle",
            hi.item, (select i->>'text' from jsonb_array_elements(l.items) i where i->>'id' = hi.item) as "itemText",
            hi.required_stars as "requiredStars", hi.completed_at as "completedAt",
            count(a.id)::int as attempts, coalesce(max(a.stars), 0)::int as "bestStars"
       from homework_items hi
       join levels l on l.id = hi.level_id
       left join attempts a on a.homework_item_id = hi.id
      where hi.homework_id = any($1::uuid[])
      group by hi.id, l.id
      order by hi.position`,
    [homework.map((h) => h.id)],
  );
  return homework.map((h) => ({
    ...h,
    items: items.filter((i) => i.homeworkId === h.id).map((i) => ({ ...i, tutorialUrl: tutorialUrl(i.item) })),
  }));
}

interface HomeworkInput {
  studentId: string;
  items: HomeworkItemInput[];
  dueDate?: string;
  note?: string;
}

async function insertHomework(q: Queryable, teacherId: string, input: HomeworkInput) {
  const { rows } = await q.query<{ id: string }>(
    `insert into homework (student_id, teacher_id, due_date, note)
     values ($1, $2, coalesce($3::date, ${TODAY_WIB}), $4) returning id`,
    [input.studentId, teacherId, input.dueDate ?? null, input.note ?? null],
  );
  for (const [index, item] of input.items.entries()) {
    await q.query(
      `insert into homework_items (homework_id, position, level_id, item, required_stars)
       values ($1, $2, $3, $4, $5)`,
      [rows[0].id, index + 1, item.levelId, item.item, item.requiredStars ?? 1],
    );
  }
  return rows[0].id;
}

type ItemFromApp = Omit<HomeworkItemInput, "levelId"> & { levelId?: string };

/**
 * Item ids are unique across the curriculum, so the level is looked up from the item. A missing or
 * wrong `levelId` from the app is corrected instead of rejecting the whole homework.
 */
async function withRealLevels(items: ItemFromApp[]): Promise<HomeworkItemInput[]> {
  const all = (await allLevels()).flatMap((l) => l.items.map((i) => ({ id: i.id, text: i.text, tier: i.tingkat, levelId: l.id })));
  /**
   * The app may build ids itself ("t1-f", "t1-fa") instead of copying them from the API. Accept, in order:
   * the exact id; the id ignoring case ("t1-f" -> "t1-F"); the exercise text, with the tier from the
   * prefix if that tier has it, else the lowest tier ("t1-fa" / "fa" -> "t3-fa").
   */
  const find = (raw: string) => {
    const exact = all.find((x) => x.id === raw);
    if (exact) return exact;
    const lower = raw.toLowerCase();
    const sameCase = all.find((x) => x.id.toLowerCase() === lower);
    if (sameCase) return sameCase;
    const [, tier, text] = /^t(\d+)-(.+)$/.exec(lower) ?? [undefined, undefined, lower];
    const byText = all.filter((x) => x.text.toLowerCase() === text).sort((a, b) => a.tier - b.tier);
    return byText.find((x) => String(x.tier) === tier) ?? byText[0];
  };
  return items.map((i) => {
    const found = find(i.item);
    if (!found) throw badRequest(`Latihan "${i.item}" tidak ada di kurikulum`);
    return { ...i, item: found.id, levelId: found.levelId };
  });
}

export async function createHomework(teacherId: string, input: Omit<HomeworkInput, "items"> & { items: ItemFromApp[] }) {
  await ownedStudent(teacherId, input.studentId);
  const items = await withRealLevels(input.items);
  const homeworkId = await db().tx((q) => insertHomework(q, teacherId, { ...input, items }));
  return (await loadHomework("h.id = $1", [homeworkId]))[0];
}

/** "Setuju Semua": one homework per child, all or nothing. */
export async function createHomeworkBatch(
  teacherId: string,
  input: { dueDate?: string; note?: string; assignments: { studentId: string; items: ItemFromApp[] }[] },
) {
  const assignments: { studentId: string; items: HomeworkItemInput[] }[] = [];
  for (const a of input.assignments) {
    await ownedStudent(teacherId, a.studentId);
    assignments.push({ studentId: a.studentId, items: await withRealLevels(a.items) });
  }
  const ids = await db().tx(async (q) => {
    const created: string[] = [];
    for (const a of assignments) {
      created.push(await insertHomework(q, teacherId, { ...a, dueDate: input.dueDate, note: input.note }));
    }
    return created;
  });
  return loadHomework("h.id = any($1::uuid[])", [ids]);
}

export function homeworkForStudent(studentId: string, status?: "assigned" | "done") {
  return status
    ? loadHomework("h.student_id = $1 and h.status = $2", [studentId, status])
    : loadHomework("h.student_id = $1", [studentId]);
}

/** All homework in the teacher's classroom, newest first, optionally for one student or status. */
export async function submissions(
  teacherId: string,
  filter: { studentId?: string; status?: "assigned" | "done"; classroomId?: string },
) {
  const classroom = await classroomOf(teacherId, filter.classroomId);
  const conditions = ["s.classroom_id = $1"];
  const params: unknown[] = [classroom.id];
  if (filter.studentId) {
    params.push(filter.studentId);
    conditions.push(`h.student_id = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    conditions.push(`h.status = $${params.length}`);
  }
  return loadHomework(conditions.join(" and "), params);
}

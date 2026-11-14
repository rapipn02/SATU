/** Reward shop: 1 star = 10 points; redeeming goes through redeem_reward() so points never go negative. */

import { db } from "../db";
import { notFound } from "../lib/errors";
import { classroomOf } from "./accounts";

const REWARD = `r.id, r.name, r.image_url as "imageUrl", r.cost_points as "costPoints", r.stock, r.active`;

export async function shopForStudent(studentId: string) {
  const { rows: student } = await db().query<{ totalPoints: number; teacherId: string }>(
    `select s.total_points as "totalPoints", c.teacher_id as "teacherId"
       from students s join classrooms c on c.id = s.classroom_id where s.id = $1`,
    [studentId],
  );
  if (!student[0]) throw notFound("Siswa tidak ditemukan");
  const [{ rows: rewards }, { rows: redemptions }] = await Promise.all([
    db().query(`select ${REWARD} from rewards r where r.teacher_id = $1 and r.active order by r.cost_points`, [
      student[0].teacherId,
    ]),
    db().query(
      `select rr.id, rr.reward_id as "rewardId", r.name, rr.points_spent as "pointsSpent", rr.status,
              rr.created_at as "createdAt", rr.given_at as "givenAt"
         from reward_redemptions rr join rewards r on r.id = rr.reward_id
        where rr.student_id = $1 order by rr.created_at desc`,
      [studentId],
    ),
  ]);
  return { totalPoints: student[0].totalPoints, rewards, redemptions };
}

export async function redeem(studentId: string, rewardId: string) {
  const { rows } = await db().query(
    `select id, reward_id as "rewardId", points_spent as "pointsSpent", status, created_at as "createdAt"
       from redeem_reward($1, $2)`,
    [studentId, rewardId],
  );
  const { rows: points } = await db().query<{ totalPoints: number }>(
    `select total_points as "totalPoints" from students where id = $1`,
    [studentId],
  );
  return { redemption: rows[0], totalPoints: points[0].totalPoints };
}

export async function teacherRewards(teacherId: string) {
  const { rows } = await db().query(`select ${REWARD} from rewards r where r.teacher_id = $1 order by r.cost_points`, [
    teacherId,
  ]);
  return rows;
}

export async function createReward(
  teacherId: string,
  input: { name: string; costPoints: number; stock?: number | null; imageUrl?: string },
) {
  const { rows } = await db().query(
    `insert into rewards as r (teacher_id, name, cost_points, stock, image_url) values ($1, $2, $3, $4, $5)
     returning ${REWARD}`,
    [teacherId, input.name, input.costPoints, input.stock ?? null, input.imageUrl ?? null],
  );
  return rows[0];
}

export async function classRedemptions(teacherId: string, status?: "requested" | "given") {
  const classroom = await classroomOf(teacherId);
  const { rows } = await db().query(
    `select rr.id, rr.student_id as "studentId", s.nickname, r.name as "rewardName", rr.points_spent as "pointsSpent",
            rr.status, rr.created_at as "createdAt", rr.given_at as "givenAt"
       from reward_redemptions rr
       join students s on s.id = rr.student_id
       join rewards r on r.id = rr.reward_id
      where s.classroom_id = $1 and ($2::text is null or rr.status = $2)
      order by rr.created_at desc`,
    [classroom.id, status ?? null],
  );
  return rows;
}

export async function markGiven(teacherId: string, redemptionId: string) {
  const classroom = await classroomOf(teacherId);
  const { rows } = await db().query(
    `update reward_redemptions rr set status = 'given', given_at = now()
       from students s
      where rr.id = $1 and s.id = rr.student_id and s.classroom_id = $2
      returning rr.id, rr.status, rr.given_at as "givenAt"`,
    [redemptionId, classroom.id],
  );
  if (!rows[0]) throw notFound("Penukaran tidak ditemukan");
  return rows[0];
}

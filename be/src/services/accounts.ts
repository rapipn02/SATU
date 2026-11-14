/** Teachers, classrooms, students (picture-password login) and parent login. */

import { config } from "../config";
import { db, type Queryable } from "../db";
import { conflict, forbidden, notFound, unauthorized } from "../lib/errors";
import { assertNotThrottled, clearFailures, recordFailure } from "../lib/login-guard";
import { hashPicturePassword, pictureSecret, signToken, verifyHash } from "../lib/security";
import { startMlSession } from "./ml-state";

export interface StudentCard {
  id: string;
  nickname: string;
  photoUrl: string | null;
  isLocked: boolean;
}

const STUDENT_CARD = `s.id, s.nickname, s.photo_url as "photoUrl", s.is_locked as "isLocked"`;

export async function teacherLogin(email: string, password: string) {
  const guardKey = `teacher:${email}`;
  assertNotThrottled(guardKey);
  const { rows } = await db().query<{ id: string; name: string; email: string; password_hash: string }>(
    "select id, name, email, password_hash from teachers where email = $1",
    [email],
  );
  const teacher = rows[0];
  if (!teacher || !(await verifyHash(password, teacher.password_hash))) {
    recordFailure(guardKey);
    throw unauthorized("Email atau kata sandi salah");
  }
  clearFailures(guardKey);
  return {
    token: signToken({ id: teacher.id, role: "teacher" }),
    role: "teacher" as const,
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
    classroom: await classroomOf(teacher.id),
    classrooms: await listClassrooms(teacher.id),
  };
}

/** The teacher's classroom: the one named by `classroomId` (404 if not theirs), else their first. */
export async function classroomOf(teacherId: string, classroomId?: string): Promise<{ id: string; name: string }> {
  const { rows } = classroomId
    ? await db().query("select id, name from classrooms where id = $1 and teacher_id = $2", [classroomId, teacherId])
    : await db().query("select id, name from classrooms where teacher_id = $1 order by created_at limit 1", [teacherId]);
  if (!rows[0]) throw notFound(classroomId ? "Kelas tidak ditemukan" : "Guru ini belum punya kelas");
  return rows[0];
}

export async function listClassrooms(teacherId: string) {
  const { rows } = await db().query(
    `select c.id, c.name, c.created_at as "createdAt", count(s.id)::int as "studentCount"
       from classrooms c left join students s on s.classroom_id = c.id
      where c.teacher_id = $1 group by c.id order by c.created_at`,
    [teacherId],
  );
  return rows;
}

export async function createClassroom(teacherId: string, name: string) {
  const taken = await db().query("select 1 from classrooms where teacher_id = $1 and lower(name) = lower($2)", [
    teacherId,
    name,
  ]);
  if (taken.rows.length) throw conflict("Nama kelas ini sudah ada");
  const { rows } = await db().query(
    `insert into classrooms (teacher_id, name) values ($1, $2) returning id, name, created_at as "createdAt"`,
    [teacherId, name],
  );
  return { ...rows[0], studentCount: 0 };
}

export async function listStudents(teacherId: string, classroomId?: string): Promise<StudentCard[]> {
  const classroom = await classroomOf(teacherId, classroomId);
  const { rows } = await db().query<StudentCard>(
    `select ${STUDENT_CARD} from students s where s.classroom_id = $1 order by s.nickname`,
    [classroom.id],
  );
  return rows;
}

export interface NewStudent {
  nickname: string;
  parentWhatsapp?: string;
  birthDate?: string;
  photoUrl?: string;
  picturePassword: number[];
  classroomId?: string;
}

/** Looks up the classroom and hashes the PIN (slow), so callers can do it before opening a transaction. */
export async function prepareStudent(teacherId: string, input: NewStudent) {
  const [classroom, pinHash] = await Promise.all([
    classroomOf(teacherId, input.classroomId),
    hashPicturePassword(input.picturePassword),
  ]);
  return { classroomId: classroom.id, pinHash };
}

export async function insertStudent(
  q: Queryable,
  input: NewStudent,
  prepared: { classroomId: string; pinHash: string },
): Promise<StudentCard & { parentWhatsapp: string | null }> {
  const { rows } = await q.query<StudentCard & { parentWhatsapp: string | null }>(
    `insert into students as s (classroom_id, nickname, parent_whatsapp, birth_date, photo_url, picture_password_hash)
     values ($1, $2, $3, $4, $5, $6)
     returning ${STUDENT_CARD}, s.parent_whatsapp as "parentWhatsapp"`,
    [
      prepared.classroomId,
      input.nickname,
      input.parentWhatsapp ?? null,
      input.birthDate ?? null,
      input.photoUrl ?? null,
      prepared.pinHash,
    ],
  );
  return rows[0];
}

/** Teacher edits a child's photo and/or nickname. Fields left out are unchanged; photoUrl null removes the photo. */
export async function updateStudent(
  teacherId: string,
  studentId: string,
  input: { nickname?: string; photoUrl?: string | null },
): Promise<StudentCard> {
  await ownedStudent(teacherId, studentId);
  const { rows } = await db().query<StudentCard>(
    `update students s
        set nickname  = coalesce($2, s.nickname),
            photo_url = case when $3::boolean then $4 else s.photo_url end
      where s.id = $1 returning ${STUDENT_CARD}`,
    [studentId, input.nickname ?? null, input.photoUrl !== undefined, input.photoUrl ?? null],
  );
  return rows[0];
}

/** Teacher sets a new picture PIN (child forgot it); also unlocks the account. */
export async function resetPicturePassword(
  teacherId: string,
  studentId: string,
  picturePassword: number[],
): Promise<StudentCard> {
  await ownedStudent(teacherId, studentId);
  const { rows } = await db().query<StudentCard>(
    `update students s set picture_password_hash = $2, failed_logins = 0, is_locked = false
      where s.id = $1 returning ${STUDENT_CARD}`,
    [studentId, await hashPicturePassword(picturePassword)],
  );
  return rows[0];
}

/** The student, if it belongs to this teacher's classroom; 404 otherwise so ids cannot be probed. */
export async function ownedStudent(teacherId: string, studentId: string) {
  const { rows } = await db().query<StudentCard & { pictureHash: string; failedLogins: number }>(
    `select ${STUDENT_CARD}, s.picture_password_hash as "pictureHash", s.failed_logins as "failedLogins"
       from students s join classrooms c on c.id = s.classroom_id
      where s.id = $1 and c.teacher_id = $2`,
    [studentId, teacherId],
  );
  if (!rows[0]) throw notFound("Siswa tidak ditemukan");
  return rows[0];
}

/** The student, if it is in this classroom (class laptop token); 404 otherwise. */
export async function classroomStudent(classroomId: string, studentId: string) {
  const { rows } = await db().query<StudentCard & { pictureHash: string; failedLogins: number }>(
    `select ${STUDENT_CARD}, s.picture_password_hash as "pictureHash", s.failed_logins as "failedLogins"
       from students s where s.id = $1 and s.classroom_id = $2`,
    [studentId, classroomId],
  );
  if (!rows[0]) throw notFound("Siswa tidak ditemukan");
  return rows[0];
}

export async function studentsOfClassroom(classroomId: string): Promise<StudentCard[]> {
  const { rows } = await db().query<StudentCard>(
    `select ${STUDENT_CARD} from students s where s.classroom_id = $1 order by s.nickname`,
    [classroomId],
  );
  return rows;
}

export async function studentLogin(student: Awaited<ReturnType<typeof ownedStudent>>, picturePassword: number[]) {
  const studentId = student.id;
  if (student.isLocked) throw forbidden("Akun terkunci. Minta guru membukanya.");

  if (!(await verifyHash(pictureSecret(picturePassword), student.pictureHash))) {
    await db().query(
      `update students set failed_logins = failed_logins + 1, is_locked = failed_logins + 1 >= $2 where id = $1`,
      [studentId, config.MAX_LOGIN_FAILURES],
    );
    throw unauthorized("Password gambar salah");
  }
  if (student.failedLogins > 0) {
    await db().query("update students set failed_logins = 0 where id = $1", [studentId]);
  }
  startMlSession(student.id);
  return {
    token: signToken({ id: student.id, role: "student", src: "school" }),
    role: "student" as const,
    student: { id: student.id, nickname: student.nickname, photoUrl: student.photoUrl, isLocked: false },
  };
}

/** Teacher sets how far the child may go (1-6); null hands control back to the AI. */
export async function setMaxLevel(teacherId: string, studentId: string, maxLevel: number | null) {
  await ownedStudent(teacherId, studentId);
  await db().query("update students set max_level = $2 where id = $1", [studentId, maxLevel]);
  return { studentId, maxLevel };
}

export async function unlockStudent(teacherId: string, studentId: string): Promise<StudentCard> {
  await ownedStudent(teacherId, studentId);
  const { rows } = await db().query<StudentCard>(
    `update students s set failed_logins = 0, is_locked = false where s.id = $1 returning ${STUDENT_CARD}`,
    [studentId],
  );
  return rows[0];
}

export async function parentLogin(email: string, password: string) {
  const guardKey = `parent:${email}`;
  assertNotThrottled(guardKey);
  const { rows } = await db().query<{ id: string; name: string; email: string; password_hash: string }>(
    "select id, name, email, password_hash from parents where email = $1 and activated_at is not null",
    [email],
  );
  const parent = rows[0];
  if (!parent || !(await verifyHash(password, parent.password_hash))) {
    recordFailure(guardKey);
    throw unauthorized("Email atau kata sandi salah");
  }
  clearFailures(guardKey);
  return {
    token: signToken({ id: parent.id, role: "parent" }),
    role: "parent" as const,
    parent: { id: parent.id, name: parent.name, email: parent.email },
  };
}

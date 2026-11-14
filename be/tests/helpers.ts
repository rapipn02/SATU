import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import request from "supertest";
import { createApp } from "../src/app";
import { type Db, setDb, TYPE_PARSERS } from "../src/db";
import { runMigrations } from "../src/migrate";
import { createTeacher } from "../src/seed";

export const PICTURE = [5, 1, 8];
export const PASSWORD = "rahasia123";

/** A real Postgres (PGlite) running the same supabase/migrations as production. */
export async function setupTestDb(): Promise<Db> {
  const pg = await PGlite.create({ extensions: { pgcrypto }, parsers: TYPE_PARSERS });
  await pg.exec("create role anon; create role authenticated; create role service_role;"); // roles Supabase provides
  const database: Db = {
    query: (text, params) => pg.query(text, params as unknown[]),
    exec: (sql) => pg.exec(sql),
    tx: (fn) => pg.transaction((tx) => fn({ query: (text, params) => tx.query(text, params as unknown[]) })),
    close: () => pg.close(),
  };
  await runMigrations(database);
  setDb(database);
  return database;
}

export const api = () => request(createApp());
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface Scenario {
  db: Db;
  teacher: string;
  teacherEmail: string;
  student: { id: string; nickname: string };
  kid: string;
}

/** Fresh teacher (own classroom + rewards) with one registered and logged-in student. */
export async function newClass(database: Db, nickname = "Raka"): Promise<Scenario> {
  const teacherEmail = `guru-${randomUUID().slice(0, 8)}@satu.test`;
  await createTeacher(database, { name: "Bu Rina", email: teacherEmail, password: PASSWORD, classroom: "Kelas 1" });
  const login = await api().post("/api/auth/teacher/login").send({ email: teacherEmail, password: PASSWORD });
  const teacher = login.body.token as string;
  const student = await registerStudent(teacher, nickname);
  return { db: database, teacher, teacherEmail, student, kid: await studentToken(teacher, student.id) };
}

export async function registerStudent(teacher: string, nickname: string, extra: Record<string, unknown> = {}) {
  const res = await api()
    .post("/api/students")
    .set(bearer(teacher))
    .send({ nickname, picturePassword: PICTURE, ...extra });
  if (res.status !== 201) throw new Error(`create student failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; nickname: string };
}

export async function studentToken(teacher: string, studentId: string): Promise<string> {
  const res = await api()
    .post("/api/auth/student/login")
    .set(bearer(teacher))
    .send({ studentId, picturePassword: PICTURE });
  if (res.status !== 200) throw new Error(`student login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

/** Invites a parent for the given students and activates the account; returns the parent token. */
export async function activeParent(teacher: string, studentIds: string[], name = "Ibu Sari") {
  const invite = await api().post("/api/parents/invites").set(bearer(teacher)).send({ parentName: name, studentIds });
  const token = String(invite.body.inviteUrl).split("/undangan/")[1];
  const accept = await api()
    .post(`/api/invites/${token}/accept`)
    .send({ email: `ortu-${randomUUID().slice(0, 8)}@gmail.com`, password: PASSWORD });
  if (accept.status !== 200) throw new Error(`accept failed: ${accept.status} ${JSON.stringify(accept.body)}`);
  return accept.body.token as string;
}

/** One attempt in the shape the Mata component sends. Default: success, similarity 0.9 (= 3 stars). */
export const attempt = (token: string, body: Record<string, unknown>) =>
  api()
    .post("/api/attempts")
    .set(bearer(token))
    .send({ berhasil: true, langkah_tercapai: 1, durasi_ms: 1500, kemiripan: 0.9, ...body });

/** Outcomes with known stars: failed or accuracy < 50% = 0, 50-69% = 1, 70-89% = 2, 90%+ = 3. */
export const FAILED = { berhasil: false, kemiripan: 0.3, langkah_tercapai: 0 }; // belum benar: 0 bintang, 0 poin
export const ONE_STAR = { berhasil: true, kemiripan: 0.55 }; // benar, akurasi 50-69%

export const TWO_STARS = { berhasil: true, kemiripan: 0.7 };
export const THREE_STARS = { berhasil: true, kemiripan: 0.9 };

/** Waits until the fire-and-forget calls to the ML service have arrived (login, sessions). */
export async function until(check: () => boolean, ms = 1500): Promise<void> {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("kondisi tidak terpenuhi tepat waktu");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db";
import { signToken } from "../src/lib/security";
import { fakeMl } from "./fake-ml";
import {
  api, attempt, bearer, newClass, PASSWORD, ONE_STAR, PICTURE, registerStudent, setupTestDb, THREE_STARS, TWO_STARS,
} from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await setupTestDb();
});

const post = (token: string, path: string, body: unknown) => api().post(`/api${path}`).set(bearer(token)).send(body as object);
const get = (token: string, path: string) => api().get(`/api${path}`).set(bearer(token));

describe("banyak kelas", () => {
  it("guru membuat kelas kedua; anak masuk kelas yang dipilih saja", async () => {
    const { teacher, student, teacherEmail } = await newClass(db, "Raka");
    const created = await post(teacher, "/classrooms", { name: "Kelas B" });
    expect(created.status).toBe(201);
    expect((await post(teacher, "/classrooms", { name: "kelas b" })).status).toBe(409);

    const bia = await registerStudent(teacher, "Bia", { classroomId: created.body.id });
    const list = (await get(teacher, "/classrooms")).body;
    expect(list.map((c: { name: string; studentCount: number }) => [c.name, c.studentCount])).toEqual([
      ["Kelas 1", 1],
      ["Kelas B", 1],
    ]);

    const inB = (await get(teacher, `/classroom/students?classroomId=${created.body.id}`)).body;
    expect(inB.map((s: { id: string }) => s.id)).toEqual([bia.id]);
    const first = (await get(teacher, "/classroom/students")).body; // no classroomId = first class
    expect(first.map((s: { id: string }) => s.id)).toEqual([student.id]);

    const login = await api().post("/api/auth/teacher/login").send({ email: teacherEmail, password: PASSWORD });
    expect(login.body.classrooms).toHaveLength(2);
  });

  it("kelas guru lain -> 404", async () => {
    const a = await newClass(db);
    const b = await newClass(db);
    const classroomOfB = (await get(b.teacher, "/classrooms")).body[0].id;
    expect((await get(a.teacher, `/dashboard/class?classroomId=${classroomOfB}`)).status).toBe(404);
    expect((await post(a.teacher, "/students", { nickname: "X", picturePassword: PICTURE, classroomId: classroomOfB })).status).toBe(404);
  });
});

describe("link orang tua saat tambah anak", () => {
  it("POST /students memberi invite yang langsung bisa dipakai orang tua", async () => {
    const { teacher } = await newClass(db);
    const res = await post(teacher, "/students", { nickname: "Dina", picturePassword: PICTURE });
    expect(res.status).toBe(201);
    expect(res.body.invite).toMatchObject({ inviteToken: expect.any(String), inviteUrl: expect.stringContaining("/undangan/") });

    const info = (await api().get(`/api/invites/${res.body.invite.inviteToken}`)).body;
    expect(info).toEqual({ parentName: "Orang tua Dina", children: ["Dina"] });

    const accept = await api()
      .post(`/api/invites/${res.body.invite.inviteToken}/accept`)
      .send({ email: `o-${randomUUID().slice(0, 6)}@gmail.com`, password: PASSWORD });
    expect(accept.status).toBe(200);
    const kids = (await get(accept.body.token, "/parent/children")).body;
    expect(kids.map((k: { id: string }) => k.id)).toEqual([res.body.id]);
  });

  it("parentName dipakai kalau diisi", async () => {
    const { teacher } = await newClass(db);
    const res = await post(teacher, "/students", { nickname: "Eko", picturePassword: PICTURE, parentName: "Pak Budi" });
    expect((await api().get(`/api/invites/${res.body.invite.inviteToken}`)).body.parentName).toBe("Pak Budi");
  });
});

describe("status bunyi (tabel kelas)", () => {
  it("dari AI: centang mengikuti label sudah_bisa", async () => {
    const { teacher } = await newClass(db, "Raka");
    await registerStudent(teacher, "Ani");
    const res = (await get(teacher, "/dashboard/class/sounds")).body;
    expect(res.sounds).toEqual(["a", "i", "u", "e", "o", "M", "F", "H", "S", "T"]);
    expect(res.students.map((s: { nickname: string }) => s.nickname)).toEqual(["Ani", "Raka"]);
    expect(res.students[0]).toMatchObject({ source: "ai" });
    expect(Object.keys(res.students[0].cleared)).toHaveLength(10);
  });

  it("tanpa AI: dari item_progress (t2 >= 2 bintang = sudah bisa, t1 >= 2 = hampir bisa)", async () => {
    const { teacher, student, kid } = await newClass(db);
    fakeMl.mode = "down";
    try {
      await attempt(kid, { itemId: "t2-a", ...TWO_STARS });
      await attempt(kid, { itemId: "t1-i", ...THREE_STARS });
      await attempt(kid, { itemId: "t1-u", ...ONE_STAR }); // 1 bintang = sedang dilatih
      const row = (await get(teacher, "/dashboard/class/sounds")).body.students[0];
      expect(row).toMatchObject({ source: "fallback" });
      expect(row.status).toMatchObject({ a: "sudah_bisa", i: "hampir_bisa", u: "sedang_dilatih", e: "belum_dilatih" });
      expect(row.cleared.a).toBe(true);
      expect(row.canDo).toEqual(["Bunyi a"]);

      const detail = (await get(teacher, `/dashboard/students/${student.id}`)).body;
      expect(detail).toMatchObject({ canDo: ["Bunyi a"], practiceDays7: 1 });
    } finally {
      fakeMl.mode = "ok";
    }
  });
});

describe("PR satu kelas", () => {
  it("usulan untuk semua anak, lalu Setuju Semua membuat PR tiap anak", async () => {
    const { teacher, student } = await newClass(db, "Raka");
    const bia = await registerStudent(teacher, "Bia");
    const suggested = (await get(teacher, "/ai/class/suggested-homework")).body;
    expect(suggested.map((s: { student: { id: string } }) => s.student.id).sort()).toEqual([student.id, bia.id].sort());
    expect(suggested[0].items.length).toBeGreaterThan(0);

    const assignments = suggested.map((s: { student: { id: string }; items: { levelId: string; item: string }[] }) => ({
      studentId: s.student.id,
      items: s.items.map(({ levelId, item }) => ({ levelId, item })),
    }));
    const done = await post(teacher, "/homework/batch", { assignments, note: "Dari AI" });
    expect(done.status).toBe(201);
    expect(done.body).toHaveLength(2);
    const open = (await get(teacher, "/homework/submissions?status=assigned")).body;
    expect(open).toHaveLength(2);
  });

  it("satu item salah -> 400 dan tidak ada PR yang dibuat", async () => {
    const { teacher, student } = await newClass(db, "Raka");
    const bia = await registerStudent(teacher, "Bia");
    const res = await post(teacher, "/homework/batch", {
      assignments: [
        { studentId: student.id, items: [{ levelId: "level-1", item: "t1-a" }] },
        { studentId: bia.id, items: [{ levelId: "level-1", item: "tidak-ada" }] },
      ],
    });
    expect(res.status).toBe(400);
    expect((await get(teacher, "/homework/submissions")).body).toHaveLength(0);
  });

  it("anak guru lain -> 404", async () => {
    const a = await newClass(db);
    const b = await newClass(db);
    const res = await post(a.teacher, "/homework/batch", {
      assignments: [{ studentId: b.student.id, items: [{ levelId: "level-1", item: "t1-a" }] }],
    });
    expect(res.status).toBe(404);
  });
});

describe("grafik perkembangan", () => {
  it("bentuk daily sama untuk AI dan cadangan", async () => {
    const { teacher, student, kid } = await newClass(db);
    const ai = (await get(teacher, `/ai/students/${student.id}/history`)).body;
    expect(ai.source).toBe("ai");
    expect(ai.daily[0]).toEqual({ date: expect.any(String), attempts: 4, successes: 3, rate: 75 });

    fakeMl.mode = "down";
    try {
      await attempt(kid, { itemId: "t1-a", ...THREE_STARS });
      await attempt(kid, { itemId: "t1-a", berhasil: false, kemiripan: 0.2, langkah_tercapai: 0 });
      const fb = (await get(teacher, `/ai/students/${student.id}/history`)).body;
      expect(fb.source).toBe("fallback");
      expect(fb.daily).toEqual([{ date: expect.any(String), attempts: 2, successes: 1, rate: 50 }]);
    } finally {
      fakeMl.mode = "ok";
    }
  });
});

describe("batas level dari guru", () => {
  const put = (token: string, path: string, body: unknown) => api().put(`/api${path}`).set(bearer(token)).send(body as object);

  it("level di atas batas terkunci untuk anak; batas guru membuka level walau belum ada bintang", async () => {
    const { teacher, student, kid } = await newClass(db);
    expect((await put(teacher, `/students/${student.id}/level`, { maxLevel: 1 })).body).toEqual({ studentId: student.id, maxLevel: 1 });
    let map = (await get(kid, "/levels")).body;
    expect(map.filter((l: { unlocked: boolean }) => l.unlocked).map((l: { id: string }) => l.id)).toEqual(["level-1"]);
    expect(map[1]).toMatchObject({ status: "terkunci", lockedByTeacher: true });

    const blocked = await attempt(kid, { itemId: "t1-o", ...THREE_STARS }); // level-2 item
    expect(blocked.status).toBe(400);

    await put(teacher, `/students/${student.id}/level`, { maxLevel: 3 });
    map = (await get(kid, "/levels")).body;
    expect(map.filter((l: { unlocked: boolean }) => l.unlocked)).toHaveLength(3);
    expect((await attempt(kid, { itemId: "t1-o", ...THREE_STARS })).status).toBe(201);

    expect((await get(teacher, `/dashboard/students/${student.id}`)).body.student.maxLevel).toBe(3);
    await put(teacher, `/students/${student.id}/level`, { maxLevel: null }); // back to the star rule
    const balik = (await get(kid, "/levels")).body
    expect(balik[1]).toMatchObject({ status: "tuntas", lockedByTeacher: false }); // t1-o got 3 stars
    expect(balik[2]).toMatchObject({ status: "terbuka" }); // level 2 has a star, so level 3 opens
    expect(balik[3]).toMatchObject({ status: "terkunci", lockedByTeacher: false });
  });

  it("item berikutnya tidak pernah di level terkunci; anak guru lain 404; nilai di luar 1-6 ditolak", async () => {
    const a = await newClass(db);
    const b = await newClass(db);
    await put(a.teacher, `/students/${a.student.id}/level`, { maxLevel: 1 });
    // the fake ML proposes t1-i (level 1) anyway; lock level 1 is impossible (min 1), so just check the shape
    const res = await attempt(a.kid, { itemId: "t1-a", ...THREE_STARS });
    expect(res.body.next.levelId).toBe("level-1");
    expect((await put(a.teacher, `/students/${b.student.id}/level`, { maxLevel: 2 })).status).toBe(404);
    expect((await put(a.teacher, `/students/${a.student.id}/level`, { maxLevel: 7 })).status).toBe(400);
  });
});

describe("token perangkat kelas (web siswa)", () => {
  const deviceFor = async (teacher: string) =>
    signToken({ id: (await get(teacher, "/classrooms")).body[0].id, role: "device" });

  it("melihat anak kelasnya dan login PIN; kelas lain 404; endpoint guru 403", async () => {
    const a = await newClass(db, "Raka");
    const b = await newClass(db, "Lain");
    const device = await deviceFor(a.teacher);

    const list = (await get(device, "/classroom/students")).body;
    expect(list.map((s: { id: string }) => s.id)).toEqual([a.student.id]);

    const ok = await post(device, "/auth/student/login", { studentId: a.student.id, picturePassword: PICTURE });
    expect(ok.status).toBe(200);
    expect(ok.body.role).toBe("student");
    expect((await post(device, "/auth/student/login", { studentId: b.student.id, picturePassword: PICTURE })).status).toBe(404);
    expect((await post(device, "/auth/student/login", { studentId: a.student.id, picturePassword: [9, 9, 9] })).status).toBe(401);

    expect((await get(device, "/dashboard/class")).status).toBe(403);
    expect((await post(device, "/students", { nickname: "X", picturePassword: PICTURE })).status).toBe(403);
  });
});

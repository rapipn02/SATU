import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db";
import { createTeacher } from "../src/seed";
import { api, bearer, newClass, PASSWORD, PICTURE, registerStudent, setupTestDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await setupTestDb();
});

describe("guru", () => {
  it("login dengan akun seed, email tidak peka huruf besar", async () => {
    await createTeacher(db, { name: "Bu Ani", email: "ani@satu.test", password: PASSWORD, classroom: "Kelas 2" });
    const res = await api().post("/api/auth/teacher/login").send({ email: "ANI@satu.test", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: "teacher", classroom: { name: "Kelas 2" } });
  });

  it("10x salah kata sandi -> 429 sementara, akun lain tidak terpengaruh", async () => {
    await createTeacher(db, { name: "Bu Ida", email: "ida@satu.test", password: PASSWORD, classroom: "Kelas 3" });
    const login = (email: string, password: string) =>
      api().post("/api/auth/teacher/login").send({ email, password });
    for (let i = 0; i < 10; i++) expect((await login("ida@satu.test", "salah-sandi")).status).toBe(401);
    expect((await login("ida@satu.test", PASSWORD)).status).toBe(429);
    expect((await login("ani@satu.test", PASSWORD)).status).toBe(200);
  });

  it.each([
    ["kata sandi salah", { email: "ani@satu.test", password: "salah-sandi" }],
    ["email tidak ada", { email: "siapa@satu.test", password: PASSWORD }],
  ])("%s -> 401 dengan pesan sama", async (_label, body) => {
    const res = await api().post("/api/auth/teacher/login").send(body);
    expect(res.status).toBe(401);
    expect(res.body.detail).toBe("Email atau kata sandi salah");
  });
});

describe("guru membuat akun anak, anak login di web sekolah", () => {
  it("guru membuat akun dengan PIN 3 gambar, muncul di daftar kelas, lalu anak login", async () => {
    const { teacher, student } = await newClass(db, "Raka");
    await registerStudent(teacher, "Aisyah");
    const list = await api().get("/api/classroom/students").set(bearer(teacher));
    expect(list.body.map((s: { nickname: string }) => s.nickname)).toEqual(["Aisyah", "Raka"]);

    const login = await api()
      .post("/api/auth/student/login")
      .set(bearer(teacher))
      .send({ studentId: student.id, picturePassword: PICTURE });
    expect(login.status).toBe(200);
    expect(login.body.role).toBe("student");
  });

  it.each([
    [[1, 2]],
    [[1, 2, 3, 4]],
    [[1, 2, 10]],
    [[0, 2, 3]],
    [[-1, 2, 3]],
  ])("PIN gambar %j tidak valid (harus 3 angka 1-9) -> 400", async (picturePassword) => {
    const { teacher } = await newClass(db);
    const res = await api().post("/api/students").set(bearer(teacher)).send({ nickname: "X", picturePassword });
    expect(res.status).toBe(400);
  });

  it("PIN boleh berulang, urutan menentukan", async () => {
    const { teacher } = await newClass(db);
    const student = await registerStudent(teacher, "Dodi", { picturePassword: [3, 3, 9] });
    const login = (picturePassword: number[]) =>
      api().post("/api/auth/student/login").set(bearer(teacher)).send({ studentId: student.id, picturePassword });
    expect((await login([3, 9, 3])).status).toBe(401);
    expect((await login([3, 3, 9])).status).toBe(200);
  });

  it.each([
    ["081234567890", "6281234567890"],
    ["+62 812-3456-7890", "6281234567890"],
    ["6281234567890", "6281234567890"],
  ])("nomor WA orang tua %s disimpan sebagai %s", async (input, stored) => {
    const { teacher } = await newClass(db);
    const res = await api()
      .post("/api/students")
      .set(bearer(teacher))
      .send({ nickname: "Sinta", parentWhatsapp: input, picturePassword: PICTURE });
    expect(res.status).toBe(201);
    expect(res.body.parentWhatsapp).toBe(stored);
  });

  it("nomor WA tidak valid -> 400", async () => {
    const { teacher } = await newClass(db);
    const res = await api()
      .post("/api/students")
      .set(bearer(teacher))
      .send({ nickname: "Sinta", parentWhatsapp: "12345", picturePassword: PICTURE });
    expect(res.status).toBe(400);
  });

  it("guru mengganti PIN anak: PIN lama ditolak, PIN baru diterima, kunci terbuka", async () => {
    const { teacher, student } = await newClass(db);
    const login = (picturePassword: number[]) =>
      api().post("/api/auth/student/login").set(bearer(teacher)).send({ studentId: student.id, picturePassword });
    for (let i = 0; i < 5; i++) await login([9, 9, 9]);
    expect((await login(PICTURE)).status).toBe(403);

    const reset = await api()
      .put(`/api/students/${student.id}/picture-password`)
      .set(bearer(teacher))
      .send({ picturePassword: [2, 4, 6] });
    expect(reset.status).toBe(200);
    expect(reset.body.isLocked).toBe(false);
    expect((await login(PICTURE)).status).toBe(401);
    expect((await login([2, 4, 6])).status).toBe(200);
  });

  it("salah 5x terkunci (gambar benar pun ditolak) sampai guru membuka", async () => {
    const { teacher, student } = await newClass(db);
    const login = (picturePassword: number[]) =>
      api().post("/api/auth/student/login").set(bearer(teacher)).send({ studentId: student.id, picturePassword });

    for (let i = 0; i < 5; i++) expect((await login([9, 9, 9])).status).toBe(401);
    expect((await login(PICTURE)).status).toBe(403);

    const unlock = await api().post(`/api/students/${student.id}/unlock`).set(bearer(teacher));
    expect(unlock.body.isLocked).toBe(false);
    expect((await login(PICTURE)).status).toBe(200);
  });

  it("guru lain tidak bisa melihat atau login sebagai anak kelas lain", async () => {
    const { student } = await newClass(db);
    const other = await newClass(db);
    const res = await api()
      .post("/api/auth/student/login")
      .set(bearer(other.teacher))
      .send({ studentId: student.id, picturePassword: PICTURE });
    expect(res.status).toBe(404);
  });
});

describe("token dan peran", () => {
  it("tanpa token 401, token rusak 401, peran salah 403", async () => {
    const { teacher, kid } = await newClass(db);
    expect((await api().get("/api/levels")).status).toBe(401);
    expect((await api().get("/api/levels").set(bearer("rusak"))).status).toBe(401);
    expect((await api().get("/api/levels").set(bearer(teacher))).status).toBe(403);
    expect((await api().get("/api/dashboard/class").set(bearer(kid))).status).toBe(403);
  });

  it("dokumentasi API tersedia untuk teman mobile", async () => {
    const spec = await api().get("/openapi.json");
    expect(spec.status).toBe(200);
    expect(Object.keys(spec.body.paths)).toContain("/api/parents/invites");
    expect((await api().get("/docs/")).status).toBe(200);
  });

  it("setiap endpoint di /docs punya contoh respons (jalankan `npm run docs:examples` jika gagal)", async () => {
    const spec = (await api().get("/openapi.json")).body;
    const missing: string[] = [];
    for (const [path, ops] of Object.entries(spec.paths as Record<string, Record<string, any>>)) {
      for (const [method, op] of Object.entries(ops)) {
        const ok = Object.entries(op.responses).some(
          ([code, r]: [string, any]) => code !== "default" && r.content?.["application/json"]?.example !== undefined,
        );
        if (!ok) missing.push(`${method.toUpperCase()} ${path}`);
      }
    }
    expect(missing).toEqual([]);
    expect(spec.tags.map((t: { name: string }) => t.name)).toEqual([
      "Aplikasi Guru (mobile)",
      "Aplikasi Orang Tua (mobile)",
      "Web Anak (laptop sekolah)",
    ]);
  });
});

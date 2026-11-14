import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db";
import { fakeMl, fixtures } from "./fake-ml";
import {
  activeParent, api, attempt, bearer, newClass, FAILED, ONE_STAR, registerStudent, setupTestDb, studentToken, THREE_STARS, TWO_STARS,
} from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await setupTestDb();
});

describe("PR: guru -> orang tua -> anak di rumah -> guru", () => {
  it("usulan AI dikirim jadi PR, dikerjakan di rumah, muncul selesai di guru", async () => {
    const { teacher, student } = await newClass(db, "Raka");
    const suggestion = (await api().get(`/api/ai/students/${student.id}/suggested-homework`).set(bearer(teacher))).body;
    expect(suggestion.source).toBe("ai");
    expect(suggestion.items.map((i: { item: string }) => i.item)).toEqual(
      fixtures.tugas_usulan.tugas.map((t: { item: { id: string } }) => t.item.id),
    );
    expect(suggestion.items[0]).toMatchObject({ levelId: "level-1", text: expect.any(String), reason: expect.any(String) });

    const items = [
      { levelId: "level-1", item: "t1-a" },
      { levelId: "level-2", item: "t1-o" }, // still locked on the map; homework may target it anyway
    ];
    const created = await api().post("/api/homework").set(bearer(teacher)).send({ studentId: student.id, items, note: "Latihan di depan cermin" });
    expect(created.status).toBe(201);
    expect(created.body.items).toHaveLength(2);
    expect(created.body.items[0]).toMatchObject({ item: "t1-a", itemText: "a", levelTitle: "Vokal a, i, u" });

    const parent = await activeParent(teacher, [student.id]);
    const open = (await api().get(`/api/parent/children/${student.id}/homework`).set(bearer(parent))).body;
    expect(open).toHaveLength(1);
    const home = (await api().post(`/api/parent/children/${student.id}/practice-token`).set(bearer(parent))).body.token;

    const [first, second] = open[0].items;
    const play = (item: { item: string; id: string }, outcome: Record<string, unknown>) =>
      attempt(home, { itemId: item.item, homeworkItemId: item.id, ...outcome });
    expect((await play(first, FAILED)).status).toBe(201); // a failed try does not complete the item
    let r = await play(first, TWO_STARS);
    expect(r.body.homeworkDone).toBe(false);
    r = await play(second, TWO_STARS);
    expect(r.body.homeworkDone).toBe(true);

    const done = (await api().get("/api/homework/submissions?status=done").set(bearer(teacher))).body;
    expect(done).toHaveLength(1);
    expect(done[0].items[0]).toMatchObject({ attempts: 2, bestStars: 2 });
    expect(done[0].items.every((i: { completedAt: string | null }) => i.completedAt)).toBe(true);

    const detail = (await api().get(`/api/dashboard/students/${student.id}`).set(bearer(teacher))).body;
    const fromHome = detail.recentAttempts.filter((a: { source: string }) => a.source === "home");
    expect(fromHome).toHaveLength(3);
    expect(fromHome[0]).toMatchObject({ itemText: "o", success: true });
  });

  it("tanpa layanan AI, usulan PR dari aturan: item paling sedikit dilatih di level terbuka", async () => {
    const { teacher, student, kid } = await newClass(db);
    await attempt(kid, { itemId: "t1-a", ...THREE_STARS });
    fakeMl.mode = "down";
    const suggestion = (await api().get(`/api/ai/students/${student.id}/suggested-homework`).set(bearer(teacher))).body;
    expect(suggestion.source).toBe("fallback");
    // t1-a already has 3 stars; level 2 is open (star rule), map exercises come before stage-2 ones
    expect(suggestion.items.map((i: { item: string }) => i.item)).toEqual(["t1-i", "t1-u", "t1-e"]);
    expect(suggestion.items[0]).toMatchObject({ levelId: "level-1", text: "i", reason: "Belum pernah dicoba" });
  });

  it("usulan ML yang tidak ada di kurikulum ditolak -> aturan cadangan", async () => {
    const { teacher, student } = await newClass(db);
    const original = fixtures.tugas_usulan;
    fixtures.tugas_usulan = {
      ...original,
      tugas: [{ ...original.tugas[0], item: { ...original.tugas[0].item, id: "t9-ngawur" } }],
    };
    try {
      const suggestion = (await api().get(`/api/ai/students/${student.id}/suggested-homework`).set(bearer(teacher))).body;
      expect(suggestion.source).toBe("fallback");
    } finally {
      fixtures.tugas_usulan = original;
    }
  });

  it("item PR tidak cocok dengan percobaan -> 400; PR anak lain -> 404", async () => {
    const { teacher, student, kid } = await newClass(db);
    const hw = await api().post("/api/homework").set(bearer(teacher)).send({ studentId: student.id, items: [{ levelId: "level-1", item: "t1-a" }] });
    const homeworkItemId = hw.body.items[0].id;
    expect((await attempt(kid, { itemId: "t1-i", homeworkItemId })).status).toBe(400);

    const other = await registerStudent(teacher, "Lain");
    const otherKid = await studentToken(teacher, other.id);
    expect((await attempt(otherKid, { itemId: "t1-a", homeworkItemId })).status).toBe(404);
  });

  it.each([
    [{ items: [{ levelId: "level-1", item: "pesawat" }] }, 400],
    [{ items: [{ levelId: "level-1", item: "t9-zz" }] }, 400], // exercise not in the curriculum
    [{ items: [] }, 400],
  ])("PR tidak valid %j -> %i", async (body, status) => {
    const { teacher, student } = await newClass(db);
    expect((await api().post("/api/homework").set(bearer(teacher)).send({ studentId: student.id, ...body })).status).toBe(status);
  });
});

describe("monitoring dan ringkasan AI", () => {
  it("dashboard kelas menghitung latihan hari ini dan streak putus", async () => {
    const { teacher, kid } = await newClass(db, "Raka");
    await registerStudent(teacher, "Sinta");
    for (let i = 0; i < 3; i++) await attempt(kid, { itemId: "t1-a", ...TWO_STARS });

    const overview = (await api().get("/api/dashboard/class").set(bearer(teacher))).body;
    expect(overview.totals).toMatchObject({ students: 2, practisedToday: 1, practicesToday: 3, brokenStreaks: 1 });
    const raka = overview.students.find((s: { nickname: string }) => s.nickname === "Raka");
    expect(raka).toMatchObject({ todayCount: 3, streak: 1, levelsDone: 1, totalPoints: 60 });
  });

  it("ringkasan AI per anak: level dan kendala dari layanan AI, saran belajar ikut", async () => {
    const { teacher, student, kid } = await newClass(db);
    await attempt(kid, { itemId: "t1-a", ...THREE_STARS });

    const insight = (await api().get(`/api/ai/students/${student.id}/insight`).set(bearer(teacher))).body;
    expect(insight).toMatchObject({ source: "ai", level: "Vokal a, i, u", adviceWriter: expect.any(String) });
    expect(insight.summary).toContain("level 1 (Vokal a, i, u)");
    expect(insight.summary).toContain("Baru naik minggu ini: a");
    expect(insight.sounds[0]).toMatchObject({ bunyi: "a", label: expect.any(String) });
    expect(insight.advice.length).toBeGreaterThan(0);
    expect(fakeMl.callsTo("POST", /saran-belajar$/)[0].body).toEqual({ nama: "Raka" });
  });

  it("ringkasan AI per anak tanpa layanan AI: aturan dari bintang level", async () => {
    const { teacher, student, kid } = await newClass(db);
    for (let i = 0; i < 3; i++) await attempt(kid, { itemId: "t1-a", ...ONE_STAR });
    fakeMl.mode = "down";

    const insight = (await api().get(`/api/ai/students/${student.id}/insight`).set(bearer(teacher))).body;
    expect(insight).toMatchObject({ source: "fallback", level: expect.any(String), sounds: [], advice: [] });
    expect(insight.summary).toContain("1 dari 6 level");
    expect(insight.issues[0]).toMatchObject({ item: "Vokal a, i, u" }); // 3 attempts, best 1 star
  });

  it("ringkasan kelas: dari layanan AI, dan cadangan kalau mati", async () => {
    const { teacher, kid } = await newClass(db);
    await attempt(kid, { itemId: "t1-a", ...THREE_STARS });

    const ai = (await api().get("/api/ai/class/insight").set(bearer(teacher))).body;
    expect(ai).toMatchObject({ source: "ai", summary: fixtures.kelas_ringkasan.ringkasan });
    expect(fakeMl.callsTo("POST", /^\/kelas\/ringkasan$/)[0].body.anak).toEqual([expect.objectContaining({ nama: "Raka" })]);

    fakeMl.mode = "down";
    const cls = (await api().get("/api/ai/class/insight").set(bearer(teacher))).body;
    expect(cls.source).toBe("fallback");
    expect(cls.summary).toContain("1 dari 1 anak sudah berlatih hari ini");
    const stored = await db.query("select count(*)::int as n from ai_insights");
    expect(stored.rows[0].n).toBeGreaterThanOrEqual(2);
  });

  it("riwayat harian untuk grafik: dari layanan AI, cadangan dari percobaan tersimpan", async () => {
    const { teacher, student, kid } = await newClass(db);
    await attempt(kid, { itemId: "t1-a", ...THREE_STARS });
    await attempt(kid, { itemId: "t1-a", ...FAILED });

    const ai = (await api().get(`/api/ai/students/${student.id}/history`).set(bearer(teacher))).body;
    expect(ai).toMatchObject({ source: "ai", daily: [expect.objectContaining({ date: expect.any(String), rate: 75 })] });

    fakeMl.mode = "down";
    const local = (await api().get(`/api/ai/students/${student.id}/history`).set(bearer(teacher))).body;
    expect(local).toMatchObject({ source: "fallback", perSound: {}, daily: [{ attempts: 2, successes: 1, rate: 50 }] });
  });

  it("tanya AI tentang anak: jawaban dari layanan AI, cadangan pesan jelas; anak kelas lain 404", async () => {
    const { teacher, student } = await newClass(db);
    const ask = (id: string, token: string, question = "Bunyi apa yang paling sulit?") =>
      api().post(`/api/ai/students/${id}/ask`).set(bearer(token)).send({ question });

    const ai = await ask(student.id, teacher);
    expect(ai.body).toMatchObject({ source: "ai", answer: fixtures.tanya.jawaban });
    expect(fakeMl.callsTo("POST", /tanya$/)[0].body).toEqual({
      nama: "Raka",
      pertanyaan: "Bunyi apa yang paling sulit?",
      pembaca: "guru",
    });

    expect((await ask(student.id, teacher, "ab")).status).toBe(400); // too short
    expect((await ask(student.id, (await newClass(db)).teacher)).status).toBe(404);

    fakeMl.mode = "down";
    expect((await ask(student.id, teacher)).body).toMatchObject({
      source: "fallback",
      answer: expect.stringContaining("tidak tersedia"),
    });
  });
});

describe("hadiah", () => {
  it("poin kurang ditolak; cukup -> poin berkurang, guru menandai diserahkan", async () => {
    const { teacher, kid } = await newClass(db);
    const shop = (await api().get("/api/rewards").set(bearer(kid))).body;
    const sticker = shop.rewards.find((r: { name: string }) => r.name === "Stiker bintang"); // 30 points
    expect((await api().post(`/api/rewards/${sticker.id}/redeem`).set(bearer(kid))).status).toBe(400);

    await attempt(kid, { itemId: "t1-a", ...THREE_STARS }); // +30
    const redeemed = await api().post(`/api/rewards/${sticker.id}/redeem`).set(bearer(kid));
    expect(redeemed.status).toBe(201);
    expect(redeemed.body.totalPoints).toBe(0);

    const pending = (await api().get("/api/teacher/redemptions?status=requested").set(bearer(teacher))).body;
    expect(pending).toHaveLength(1);
    const given = await api().post(`/api/teacher/redemptions/${pending[0].id}/give`).set(bearer(teacher));
    expect(given.body.status).toBe("given");
  });

  it("stok habis -> 409; hadiah guru lain -> 404", async () => {
    const { teacher, kid } = await newClass(db);
    const limited = await api().post("/api/teacher/rewards").set(bearer(teacher)).send({ name: "Gantungan", costPoints: 10, stock: 1 });
    await attempt(kid, { itemId: "t1-a", ...THREE_STARS }); // 30 points
    expect((await api().post(`/api/rewards/${limited.body.id}/redeem`).set(bearer(kid))).status).toBe(201);
    expect((await api().post(`/api/rewards/${limited.body.id}/redeem`).set(bearer(kid))).status).toBe(409);

    const other = await newClass(db);
    expect((await api().post(`/api/rewards/${limited.body.id}/redeem`).set(bearer(other.kid))).status).toBe(404);
  });
});

describe("ubah data anak (PATCH /students/:id)", () => {
  const patch = (token: string, id: string, body: unknown) =>
    api().patch(`/api/students/${id}`).set(bearer(token)).send(body as object);

  it("ganti foto (link atau data URL) dan nama; null menghapus foto; anak guru lain 404", async () => {
    const { teacher, student } = await newClass(db, "Gibran");
    const foto = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    expect((await patch(teacher, student.id, { photoUrl: foto })).body).toMatchObject({ id: student.id, nickname: "Gibran", photoUrl: foto });
    expect((await patch(teacher, student.id, { nickname: "Gibran A" })).body).toMatchObject({ nickname: "Gibran A", photoUrl: foto });
    expect((await patch(teacher, student.id, { photoUrl: null })).body.photoUrl).toBeNull();

    const list = (await api().get("/api/classroom/students").set(bearer(teacher))).body;
    expect(list[0]).toMatchObject({ nickname: "Gibran A", photoUrl: null });

    expect((await patch(teacher, student.id, {})).status).toBe(400);
    const other = await newClass(db);
    expect((await patch(other.teacher, student.id, { nickname: "X" })).status).toBe(404);
  });
});

describe("usulan PR disaring dengan bintang", () => {
  it("usulan AI yang sudah 3 bintang dibuang dan diganti latihan peta yang belum selesai", async () => {
    const { teacher, student, kid } = await newClass(db);
    await attempt(kid, { itemId: "t1-a", ...THREE_STARS }); // the fake AI still proposes t1-i, t1-a, t1-u
    const s = (await api().get(`/api/ai/students/${student.id}/suggested-homework`).set(bearer(teacher))).body;
    expect(s.source).toBe("ai");
    expect(s.items.map((i: { item: string }) => i.item)).toEqual(["t1-i", "t1-u", "t1-e"]);
    expect(s.items[2]).toMatchObject({ levelId: "level-2", reason: "Belum pernah dicoba" });
  });
});

describe("tugas selesai lewat latihan di peta (tanpa homeworkItemId)", () => {
  it("latihan benar pada item tugas menyelesaikan tugas; percobaan 0 bintang tidak", async () => {
    const { teacher, student, kid } = await newClass(db);
    await api().post("/api/homework").set(bearer(teacher)).send({
      studentId: student.id,
      items: [{ levelId: "level-1", item: "t1-a" }],
    });
    await attempt(kid, { itemId: "t1-a", ...FAILED }); // 0 stars: homework stays open
    let hw = (await api().get(`/api/homework/submissions`).set(bearer(teacher))).body;
    expect(hw[0]).toMatchObject({ status: "assigned" });

    const res = await attempt(kid, { itemId: "t1-a", ...TWO_STARS }); // web map: no homeworkItemId
    expect(res.body.homeworkDone).toBe(true);
    hw = (await api().get(`/api/homework/submissions`).set(bearer(teacher))).body;
    expect(hw[0]).toMatchObject({ status: "done" });
    expect(hw[0].items[0]).toMatchObject({ attempts: 2, bestStars: 2 });
  });
});

describe("grafik belajar per hari (guru dan orang tua)", () => {
  it("7 hari terisi (hari kosong = 0); hari ini berisi latihan, benar, akurasi, poin; orang tua dapat data sama", async () => {
    const { teacher, student, kid } = await newClass(db);
    await attempt(kid, { itemId: "t1-a", ...THREE_STARS }); // 90% -> 3 stars, 30 points
    await attempt(kid, { itemId: "t1-i", ...FAILED }); // 30% -> 0 stars
    const g = (await api().get(`/api/dashboard/students/${student.id}/chart`).set(bearer(teacher))).body;
    expect(g.days).toBe(7);
    expect(g.labels).toHaveLength(7);
    expect(g.labels[6]).toMatch(/^(Min|Sen|Sel|Rab|Kam|Jum|Sab) \d{1,2}\/\d{1,2}$/);
    expect(g.series.attempts).toEqual([0, 0, 0, 0, 0, 0, 2]);
    expect(g.series.correct[6]).toBe(1);
    expect(g.series.points[6]).toBe(30);
    expect(g.series.accuracy[6]).toBe(60); // average of 90 and 30
    expect(g.summary).toEqual({ practiceDays: 1, attempts: 2, correct: 1, points: 30, accuracy: 60 });

    expect((await api().get(`/api/dashboard/students/${student.id}/chart?days=30`).set(bearer(teacher))).body.labels).toHaveLength(30);
    expect((await api().get(`/api/dashboard/students/${student.id}/chart?days=0`).set(bearer(teacher))).status).toBe(400);

    const parent = await activeParent(teacher, [student.id]);
    const p = (await api().get(`/api/parent/children/${student.id}/chart`).set(bearer(parent))).body;
    expect(p.series).toEqual(g.series);
    const other = await newClass(db);
    expect((await api().get(`/api/parent/children/${other.student.id}/chart`).set(bearer(parent))).status).toBe(404);
  });
});

describe("levelId PR dibetulkan backend", () => {
  it("levelId salah dibetulkan, levelId kosong diterima, latihan tidak dikenal tetap 400", async () => {
    const { teacher, student } = await newClass(db);
    const kirim = (items: unknown[]) => api().post("/api/homework").set(bearer(teacher)).send({ studentId: student.id, items });

    const salah = await kirim([{ levelId: "level-1", item: "t1-e" }]); // "e" is in level-2
    expect(salah.status).toBe(201);
    expect(salah.body.items[0]).toMatchObject({ levelId: "level-2", item: "t1-e", itemText: "e" });

    const kosong = await kirim([{ item: "t3-ma" }, { item: "t1-a" }]);
    expect(kosong.status).toBe(201);
    expect(kosong.body.items.map((i: { levelId: string }) => i.levelId)).toEqual(["level-5", "level-1"]);

    const tidakAda = await kirim([{ item: "t9-zz" }]);
    expect(tidakAda.status).toBe(400);
    expect(tidakAda.body.detail).toContain("tidak ada di kurikulum");
  });
});

describe("id latihan buatan aplikasi dibetulkan", () => {
  it("t1-f -> t1-F, t1-fa -> t3-fa, teks 'mama' -> t4-mama, 'a' -> t1-a; t1-w tetap 400", async () => {
    const { teacher, student } = await newClass(db);
    const kirim = (items: unknown[]) => api().post("/api/homework").set(bearer(teacher)).send({ studentId: student.id, items });

    // the exact body the teacher app sent (wrong case, wrong tier prefix, wrong levelId)
    const res = await kirim([
      { levelId: "level-3", item: "t1-f" },
      { levelId: "level-1", item: "t1-fa" },
      { levelId: "level-1", item: "t1-ha" },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.items.map((i: { item: string; levelId: string }) => `${i.item}@${i.levelId}`)).toEqual([
      "t1-F@level-3", "t3-fa@level-5", "t3-ha@level-5",
    ]);

    const teks = await kirim([{ item: "mama" }, { item: "a" }]);
    expect(teks.body.items.map((i: { item: string }) => i.item)).toEqual(["t4-mama", "t1-a"]);

    expect((await kirim([{ item: "t1-w" }])).status).toBe(400); // w is not in the curriculum yet
  });
});

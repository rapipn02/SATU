import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db";
import { fakeMl, fixtures } from "./fake-ml";
import {
  api, attempt, bearer, FAILED, newClass, ONE_STAR, setupTestDb, studentToken, THREE_STARS, TWO_STARS, until,
} from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await setupTestDb();
});

const mapOf = async (kid: string) => (await api().get("/api/levels").set(bearer(kid))).body;

describe("peta petualangan (kurikulum milik layanan AI)", () => {
  it("6 level dari ML; hanya level 1 terbuka; tiap item punya bintang terbaik", async () => {
    const { kid } = await newClass(db);
    const map = await mapOf(kid);
    expect(map.map((l: { id: string }) => l.id)).toEqual(["level-1", "level-2", "level-3", "level-4", "level-5", "level-6"]);
    expect([...new Set(map.map((l: { category: string }) => l.category))]).toEqual(["vokal", "konsonan", "suku_kata", "kata"]);
    expect(map[0]).toMatchObject({ unlocked: true, status: "terbuka", source: "stars", title: "Vokal a, i, u" });
    expect(map.filter((l: { unlocked: boolean }) => l.unlocked)).toHaveLength(1);
    expect(map[0].items[0]).toMatchObject({ id: "t1-a", text: "a", tingkat: 1, urutan: ["a"], bestStars: 0 });
    expect(map[4].items[0]).toMatchObject({ id: "t3-ma", urutan: ["M", "a"] });
    expect(map.reduce((n: number, l: { items: unknown[] }) => n + l.items.length, 0)).toBe(98);
  });

  it("level dari bintang saja: AI menganggap level 2 terkunci, tapi 1 bintang di level 1 sudah membukanya", async () => {
    const { kid } = await newClass(db);
    await attempt(kid, { itemId: "t1-a", ...THREE_STARS }); // fake ML still reports level 2 as "terkunci"
    const map = await mapOf(kid);
    expect(map[0]).toMatchObject({ status: "tuntas", bestStars: 3, progress: 1 });
    expect(map[1]).toMatchObject({ status: "terbuka", unlocked: true });
    expect(map[2]).toMatchObject({ status: "terkunci", unlocked: false });
    expect((await attempt(kid, { itemId: "t1-o", ...THREE_STARS })).status).toBe(201);
  });

  it("level berikutnya terbuka setelah level sebelumnya dapat 1 bintang; percobaan 0 bintang tidak membuka", async () => {
    const { kid } = await newClass(db);
    let map = await mapOf(kid);
    expect(map.filter((l: { unlocked: boolean }) => l.unlocked)).toHaveLength(1);
    await attempt(kid, { itemId: "t1-a", ...FAILED });
    expect((await mapOf(kid))[1]).toMatchObject({ unlocked: false });
    expect((await attempt(kid, { itemId: "t1-o", ...THREE_STARS })).status).toBe(400);

    await attempt(kid, { itemId: "t1-a", ...ONE_STAR });
    map = await mapOf(kid);
    expect(map[1]).toMatchObject({ unlocked: true, status: "terbuka" });
    expect((await attempt(kid, { itemId: "t1-o", ...THREE_STARS })).status).toBe(201);
  });

  it.each([
    ["item tidak dikenal", { itemId: "zz" }],
    ["id lama (teks) bukan id item", { itemId: "a" }],
    ["kemiripan di atas 1", { kemiripan: 1.5 }],
    ["kemiripan negatif", { kemiripan: -0.1 }],
    ["langkah negatif", { langkah_tercapai: -1 }],
    ["berhasil bukan boolean", { berhasil: "ya" }],
    ["durasi negatif", { durasi_ms: -5 }],
  ])("percobaan tidak valid: %s -> 400", async (_label, patch) => {
    const { kid } = await newClass(db);
    expect((await attempt(kid, { itemId: "t1-a", ...patch })).status).toBe(400);
  });
});

describe("bintang dan poin", () => {
  it("bintang dihitung server: belum benar 0; 50-69% 1; 70-89% 2; >= 90% 3", async () => {
    const { kid } = await newClass(db);
    const stars = async (body: Record<string, unknown>) => (await attempt(kid, { itemId: "t1-a", ...body })).body.stars;
    expect(await stars({ berhasil: false, kemiripan: 0.95 })).toBe(0);
    expect(await stars({ berhasil: true, kemiripan: 0.49 })).toBe(0);
    expect(await stars({ berhasil: true, kemiripan: 0.5 })).toBe(1);
    expect(await stars({ berhasil: true, kemiripan: 0.69 })).toBe(1);
    expect(await stars({ berhasil: true, kemiripan: 0.7 })).toBe(2);
    expect(await stars({ berhasil: true, kemiripan: 0.89 })).toBe(2);
    expect(await stars({ berhasil: true, kemiripan: 0.9 })).toBe(3);
  });

  it("bintang dan poin kiriman klien diabaikan (tidak bisa dipalsukan)", async () => {
    const { kid } = await newClass(db);
    const res = await attempt(kid, { itemId: "t1-a", ...FAILED, bintang: 3, poin: 9999 });
    expect(res.body).toMatchObject({ stars: 0, pointsEarned: 0, totalPoints: 0 });
  });

  it("poin = bintang x 10 tiap percobaan (0 = 0, 1 = 10, 2 = 20, 3 = 30); 0 bintang tidak masuk bintang terbaik", async () => {
    const { kid } = await newClass(db);
    const play = async (itemId: string, outcome: Record<string, unknown>) => (await attempt(kid, { itemId, ...outcome })).body;

    expect(await play("t1-a", FAILED)).toMatchObject({ stars: 0, pointsEarned: 0, totalPoints: 0, bestStars: 0, correct: false });
    expect(await play("t1-a", ONE_STAR)).toMatchObject({ pointsEarned: 10, totalPoints: 10, bestStars: 1 });
    expect(await play("t1-a", TWO_STARS)).toMatchObject({ pointsEarned: 20, totalPoints: 30, bestStars: 2 });
    expect(await play("t1-a", THREE_STARS)).toMatchObject({ pointsEarned: 30, totalPoints: 60, bestStars: 3 });
    expect(await play("t1-a", FAILED)).toMatchObject({ pointsEarned: 0, totalPoints: 60, bestStars: 3 });
    expect(await play("t1-i", FAILED)).toMatchObject({ pointsEarned: 0, totalPoints: 60, bestStars: 0 });
  });

  it("akurasi 14% walau sampai target: 0 bintang, tidak dihitung berhasil", async () => {
    const { kid } = await newClass(db);
    const res = (await attempt(kid, { itemId: "t1-a", berhasil: true, kemiripan: 0.14 })).body;
    expect(res).toMatchObject({ stars: 0, correct: false, accuracy: 14, pointsEarned: 0 });
  });

  it("peta menampilkan bintang terbaik per item", async () => {
    const { kid } = await newClass(db);
    await attempt(kid, { itemId: "t1-i", ...TWO_STARS });
    const items = (await mapOf(kid))[0].items;
    expect(items.find((i: { id: string }) => i.id === "t1-i").bestStars).toBe(2);
    expect(items.find((i: { id: string }) => i.id === "t1-a").bestStars).toBe(0);
  });
});

describe("terhubung ke layanan AI", () => {
  it("percobaan diteruskan apa adanya ke ML; balasan membawa item berikutnya dan perubahan penguasaan", async () => {
    const { kid, student } = await newClass(db);
    const res = await attempt(kid, { itemId: "t1-a", ...THREE_STARS, langkah_tercapai: 1, durasi_ms: 1800 });
    expect(res.status).toBe(201);

    const sent = fakeMl.callsTo("POST", new RegExp(`^/anak/${student.id}/percobaan$`));
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual({ item_id: "t1-a", berhasil: true, langkah_tercapai: 1, durasi_ms: 1800 });

    expect(res.body.source).toBe("ai");
    expect(res.body.next).toMatchObject({ item: { id: "t1-i", text: "i", urutan: ["i"] }, levelId: "level-1", rest: false });
    expect(res.body.mastery[0]).toMatchObject({ bunyi: "a", label: expect.any(String) });
    expect(res.body.rest).toEqual({ suggested: false, reasons: [] });
  });

  it("gagal diteruskan sebagai berhasil=false dan ML memilih item lain", async () => {
    const { kid, student } = await newClass(db);
    const res = await attempt(kid, { itemId: "t1-i", ...FAILED });
    const sent = fakeMl.callsTo("POST", new RegExp(`^/anak/${student.id}/percobaan$`));
    expect(sent[0].body).toMatchObject({ item_id: "t1-i", berhasil: false, langkah_tercapai: 0 });
    expect(res.body.next.item.id).toBe(fixtures.percobaan_gagal.berikutnya.item.id);
  });

  it("layanan AI mati: percobaan tetap tersimpan (201), item berikutnya dari aturan cadangan", async () => {
    const { kid } = await newClass(db);
    fakeMl.mode = "down";
    const res = await attempt(kid, { itemId: "t1-a", ...THREE_STARS });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ source: "fallback", mastery: [], totalPoints: 30 });
    expect(res.body.next).toMatchObject({ levelId: "level-1", reason: "fallback", rest: false });
    expect(res.body.next.item.id).not.toBe("t1-a"); // the least-practised item first
  });

  it("login anak dan token latihan rumah memulai sesi baru di ML", async () => {
    const { teacher, student } = await newClass(db); // newClass already logged the child in once
    const sessions = () => fakeMl.callsTo("POST", new RegExp(`^/anak/${student.id}/sesi$`)).length;
    await until(() => sessions() === 1);
    await studentToken(teacher, student.id);
    await until(() => sessions() === 2);
  });

  it("ML restart (status hilang): riwayat Supabase dikirim ulang, lalu peta kembali normal", async () => {
    const { kid, student } = await newClass(db);
    for (const itemId of ["t1-a", "t1-i"]) await attempt(kid, { itemId, ...THREE_STARS, durasi_ms: 1200 });
    fakeMl.calls = [];
    fakeMl.forget();

    await mapOf(kid); // opening the map restores the ML state

    const replayed = fakeMl.callsTo("POST", new RegExp(`^/anak/${student.id}/percobaan$`));
    expect(replayed.map((c) => c.body.item_id)).toEqual(["t1-a", "t1-i"]);
    expect(replayed[0].body).toMatchObject({ berhasil: true, durasi_ms: 1200 });
  });

  it("anak baru tanpa riwayat tidak memicu pengiriman ulang", async () => {
    const { kid } = await newClass(db);
    fakeMl.calls = [];
    await mapOf(kid);
    expect(fakeMl.callsTo("POST", /percobaan$/)).toHaveLength(0);
  });
});

describe("streak (hanya percobaan yang berhasil)", () => {
  const succeedThreeTimes = async (kid: string) => {
    let last;
    for (let i = 0; i < 3; i++) last = (await attempt(kid, { itemId: "t1-i", ...TWO_STARS })).body;
    return last;
  };

  it("percobaan berhasil ke-3 hari ini memulai streak; percobaan gagal tidak dihitung", async () => {
    const { kid } = await newClass(db);
    for (let i = 0; i < 4; i++) await attempt(kid, { itemId: "t1-a", ...FAILED });
    const profile = (await api().get("/api/me/student").set(bearer(kid))).body;
    expect(profile.streak).toMatchObject({ current: 0, todayCount: 0 });

    const third = await succeedThreeTimes(kid);
    expect(third).toMatchObject({ dailyCount: 3, dailyTarget: 3, streak: { current: 1, longest: 1 } });
  });

  it("aktif kemarin -> bertambah; bolong sehari -> mulai lagi dari 1", async () => {
    const yesterday = await newClass(db, "Kemarin");
    await db.query(
      `insert into streaks (student_id, current, longest, last_active_day)
       values ($1, 4, 4, (now() at time zone 'Asia/Jakarta')::date - 1)`,
      [yesterday.student.id],
    );
    expect((await succeedThreeTimes(yesterday.kid)).streak).toEqual({ current: 5, longest: 5 });

    const gap = await newClass(db, "Bolong");
    await db.query(
      `insert into streaks (student_id, current, longest, last_active_day)
       values ($1, 7, 7, (now() at time zone 'Asia/Jakarta')::date - 2)`,
      [gap.student.id],
    );
    const before = (await api().get("/api/me/student").set(bearer(gap.kid))).body.streak;
    expect(before.current).toBe(0); // shown as broken before practising today
    expect((await succeedThreeTimes(gap.kid)).streak).toEqual({ current: 1, longest: 7 });
  });

  it("profil menampilkan kalender 7 hari", async () => {
    const { kid } = await newClass(db);
    await succeedThreeTimes(kid);
    const { streak } = (await api().get("/api/me/student").set(bearer(kid))).body;
    expect(streak.last7Days).toHaveLength(7);
    expect(streak.last7Days[6]).toMatchObject({ count: 3, active: true });
    expect(streak.todayCount).toBe(3);
  });
});

describe("model bibir personal (kalibrasi dari Mata)", () => {
  const model = {
    versi: 1,
    kelas: ["a", "i", "u"],
    pusat: [[0.4, 0.1, 0.1, 0, 0.3], [0.1, 0.0, 0.3, 0, 0.1], [0.1, 0.5, 0, 0, 0.1]],
    skala: [0.1, 0.1, 0.1, 0.1, 0.1],
    jumlah: [8, 8, 8],
    akurasi: 0.92,
    pembaruan: 2,
  };

  it("disimpan, bisa diambil lagi di perangkat lain, ikut di profil, dan diteruskan ke ML", async () => {
    const { kid, student } = await newClass(db);
    expect((await api().get("/api/me/calibration").set(bearer(kid))).body).toEqual({ model: null });
    expect((await api().put("/api/me/calibration").set(bearer(kid)).send(model)).status).toBe(200);

    expect((await api().get("/api/me/calibration").set(bearer(kid))).body.model).toEqual(model);
    expect((await api().get("/api/me/student").set(bearer(kid))).body.calibration).toEqual(model);
    await until(() => fakeMl.callsTo("PUT", new RegExp(`^/anak/${student.id}/model-bibir$`)).length === 1);
    expect(fakeMl.calls.find((c) => c.method === "PUT")!.body.model.kelas).toEqual(["a", "i", "u"]);
  });

  it.each([
    ["versi salah", { ...model, versi: 2 }],
    ["pusat dan skala tidak ada", { versi: 1, kelas: ["a", "i"] }],
    ["akurasi di atas 1", { ...model, akurasi: 3 }],
    ["hanya satu kelas", { ...model, kelas: ["a"], pusat: [[1, 2, 3, 4, 5]] }],
  ])("model tidak valid: %s -> 400", async (_label, body) => {
    const { kid } = await newClass(db);
    expect((await api().put("/api/me/calibration").set(bearer(kid)).send(body)).status).toBe(400);
  });
});

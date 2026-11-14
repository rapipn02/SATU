import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db";
import { fakeMl, fixtures } from "./fake-ml";
import { activeParent, api, attempt, bearer, newClass, PASSWORD, registerStudent, setupTestDb, THREE_STARS } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await setupTestDb();
});

const tokenOf = (inviteUrl: string) => inviteUrl.split("/undangan/")[1];

describe("undangan orang tua", () => {
  it("guru pilih nama ortu + anak -> link; ortu buka link, isi Gmail + sandi, langsung masuk", async () => {
    const { teacher, student } = await newClass(db, "Raka");
    const invite = await api()
      .post("/api/parents/invites")
      .set(bearer(teacher))
      .send({ parentName: "Ibu Sari", studentIds: [student.id] });
    expect(invite.status).toBe(201);
    expect(invite.body.inviteUrl).toMatch(/^https:\/\/satu\.test\/undangan\//);
    expect(invite.body.whatsappUrl).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(invite.body.parent.status).toBe("menunggu");

    const token = tokenOf(invite.body.inviteUrl);
    const info = await api().get(`/api/invites/${token}`);
    expect(info.body).toEqual({ parentName: "Ibu Sari", children: ["Raka"] });

    const accept = await api().post(`/api/invites/${token}/accept`).send({ email: "Sari@Gmail.com", password: PASSWORD });
    expect(accept.status).toBe(200);
    const children = await api().get("/api/parent/children").set(bearer(accept.body.token));
    expect(children.body.map((c: { nickname: string }) => c.nickname)).toEqual(["Raka"]);

    const list = await api().get("/api/parents").set(bearer(teacher));
    expect(list.body[0]).toMatchObject({ name: "Ibu Sari", status: "aktif", email: "sari@gmail.com" });

    const login = await api().post("/api/auth/parent/login").send({ email: "sari@gmail.com", password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it("link WhatsApp langsung ke nomor ortu yang disimpan guru; token tersedia untuk aplikasi mobile", async () => {
    const { teacher } = await newClass(db);
    const child = await registerStudent(teacher, "Bima", { parentWhatsapp: "081234567890" });
    const invite = await api().post("/api/parents/invites").set(bearer(teacher)).send({ parentName: "Ibu Bima", studentIds: [child.id] });
    expect(invite.body.whatsappUrl).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(invite.body.inviteToken).toBe(tokenOf(invite.body.inviteUrl));
    expect((await api().get(`/api/invites/${invite.body.inviteToken}`)).body.children).toEqual(["Bima"]);
  });

  it("link hanya sekali pakai", async () => {
    const { teacher, student } = await newClass(db);
    const invite = await api().post("/api/parents/invites").set(bearer(teacher)).send({ parentName: "Ayah", studentIds: [student.id] });
    const token = tokenOf(invite.body.inviteUrl);
    await api().post(`/api/invites/${token}/accept`).send({ email: "ayah1@gmail.com", password: PASSWORD });
    expect((await api().get(`/api/invites/${token}`)).status).toBe(404);
    expect((await api().post(`/api/invites/${token}/accept`).send({ email: "ayah2@gmail.com", password: PASSWORD })).status).toBe(404);
  });

  it("link kedaluwarsa ditolak; guru buat link baru dan link lama hangus", async () => {
    const { teacher, student } = await newClass(db);
    const invite = await api().post("/api/parents/invites").set(bearer(teacher)).send({ parentName: "Ibu", studentIds: [student.id] });
    const oldToken = tokenOf(invite.body.inviteUrl);
    await db.query("update parent_invites set expires_at = now() - interval '1 minute' where parent_id = $1", [invite.body.parent.id]);
    expect((await api().get(`/api/invites/${oldToken}`)).status).toBe(404);

    const again = await api().post(`/api/parents/${invite.body.parent.id}/invites`).set(bearer(teacher));
    expect(again.status).toBe(201);
    expect((await api().get(`/api/invites/${tokenOf(again.body.inviteUrl)}`)).status).toBe(200);
  });

  it("email yang sudah dipakai -> 409 dan link tetap bisa dipakai dengan email lain", async () => {
    const { teacher, student } = await newClass(db);
    await activeParent(teacher, [student.id]); // uses a random email
    const taken = "dipakai@gmail.com";
    const first = await api().post("/api/parents/invites").set(bearer(teacher)).send({ parentName: "A", studentIds: [student.id] });
    await api().post(`/api/invites/${tokenOf(first.body.inviteUrl)}/accept`).send({ email: taken, password: PASSWORD });

    const second = await api().post("/api/parents/invites").set(bearer(teacher)).send({ parentName: "B", studentIds: [student.id] });
    const token = tokenOf(second.body.inviteUrl);
    expect((await api().post(`/api/invites/${token}/accept`).send({ email: taken, password: PASSWORD })).status).toBe(409);
    expect((await api().post(`/api/invites/${token}/accept`).send({ email: "lain@gmail.com", password: PASSWORD })).status).toBe(200);
  });

  it("satu ortu untuk kakak-adik; anak dari kelas lain ditolak", async () => {
    const { teacher, student } = await newClass(db, "Kakak");
    const adik = await registerStudent(teacher, "Adik");
    const parent = await activeParent(teacher, [student.id, adik.id]);
    const names = (await api().get("/api/parent/children").set(bearer(parent))).body.map((c: { nickname: string }) => c.nickname);
    expect(names).toEqual(["Adik", "Kakak"]);

    const other = await newClass(db, "Orang lain");
    const res = await api().post("/api/parents/invites").set(bearer(teacher)).send({ parentName: "X", studentIds: [other.student.id] });
    expect(res.status).toBe(404);
  });

  it.each(["homework", "streak", "progress"])("ortu tidak bisa membuka %s anak orang lain", async (path) => {
    const mine = await newClass(db);
    const parent = await activeParent(mine.teacher, [mine.student.id]);
    const other = await newClass(db);
    expect((await api().get(`/api/parent/children/${other.student.id}/${path}`).set(bearer(parent))).status).toBe(404);
    expect((await api().post(`/api/parent/children/${other.student.id}/practice-token`).set(bearer(parent))).status).toBe(404);
  });
});

describe("AI untuk orang tua", () => {
  const setup = async () => {
    const klass = await newClass(db);
    const parent = await activeParent(klass.teacher, [klass.student.id]);
    return { ...klass, parent };
  };

  it("laporan mingguan dari layanan AI", async () => {
    const { parent, student } = await setup();
    const res = await api().get(`/api/parent/children/${student.id}/weekly-report`).set(bearer(parent));
    expect(res.body).toMatchObject({
      source: "ai",
      achieved: fixtures.laporan_mingguan.sudah_bisa,
      practising: fixtures.laporan_mingguan.sedang_dilatih,
      howToHelp: fixtures.laporan_mingguan.cara_membantu,
    });
    expect(fakeMl.callsTo("POST", /laporan-mingguan$/)[0].body).toEqual({ nama: "Raka" });
  });

  it("laporan mingguan tanpa layanan AI: ringkasan sekolah vs rumah dari data sendiri", async () => {
    const { parent, student, kid } = await setup();
    await attempt(kid, { itemId: "t1-a", ...THREE_STARS });
    fakeMl.mode = "down";
    const res = await api().get(`/api/parent/children/${student.id}/weekly-report`).set(bearer(parent));
    expect(res.body).toMatchObject({ source: "fallback", practiceDays: 1, writer: null });
    expect(res.body.achieved).toContain("berlatih 1 kali minggu ini (1 di sekolah, 0 di rumah)");
    expect(res.body.howToHelp.length).toBeGreaterThan(10);
  });

  it("tanya AI sebagai orang tua memakai pembaca orang_tua", async () => {
    const { parent, student } = await setup();
    const res = await api()
      .post(`/api/parent/children/${student.id}/ask`)
      .set(bearer(parent))
      .send({ question: "Apa yang bisa kami latih di rumah?" });
    expect(res.body).toMatchObject({ source: "ai", answer: fixtures.tanya.jawaban });
    expect(fakeMl.callsTo("POST", /tanya$/)[0].body.pembaca).toBe("orang_tua");
  });

  it.each(["weekly-report", "ask"])("ortu tidak bisa memakai %s untuk anak orang lain", async (path) => {
    const { parent } = await setup();
    const other = await newClass(db);
    const url = `/api/parent/children/${other.student.id}/${path}`;
    const res =
      path === "ask"
        ? await api().post(url).set(bearer(parent)).send({ question: "Bagaimana kabarnya?" })
        : await api().get(url).set(bearer(parent));
    expect(res.status).toBe(404);
  });
});

describe("video tutorial per latihan", () => {
  it("tugas orang tua membawa tutorialUrl; videonya tersaji; latihan tanpa video = null", async () => {
    const { teacher, student } = await newClass(db);
    await api().post("/api/homework").set(bearer(teacher)).send({
      studentId: student.id,
      items: [{ levelId: "level-1", item: "t1-a" }, { levelId: "level-2", item: "t2-o" }],
    });
    const parent = await activeParent(teacher, [student.id]);
    const hw = (await api().get(`/api/parent/children/${student.id}/homework`).set(bearer(parent))).body;
    const [a, o] = hw[0].items;
    expect(a.tutorialUrl).toMatch(/\/tutorial\/t1-a\.mp4$/);
    expect(o.tutorialUrl).toBeNull(); // no video for the stage-2 "o" yet

    const video = await api().get("/tutorial/t1-a.mp4");
    expect(video.status).toBe(200);
    expect(video.headers["content-type"]).toBe("video/mp4");
  });
});

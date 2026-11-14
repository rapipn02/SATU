/**
 * Contract check against the REAL ML service (not the fake used by the tests).
 *
 *   (aisatu-main/backend)  python -m uvicorn main:app --port 8000
 *   (be)                   AI_URL=http://127.0.0.1:8000/ai npm run check:ai
 *
 * Runs the whole flow on an in-memory database and prints where each answer came from.
 * Every step must say "ai"; "fallback" means the Express adapter and the ML service disagree.
 * Note: steps that write text (advice, tasks, report, question) call the LLM configured in the ML service.
 */
export {}; // makes this a module so top-level await type-checks

Object.assign(process.env, {
  DATABASE_URL: "postgres://unused",
  JWT_SECRET: "check-ai-secret-key-with-32-characters!!!",
  PASSWORD_BCRYPT_ROUNDS: "4",
  PICTURE_BCRYPT_ROUNDS: "4",
});
if (!process.env.AI_URL) throw new Error("Isi AI_URL, contoh: AI_URL=http://127.0.0.1:8000/ai npm run check:ai");

const { setupTestDb, api, bearer } = await import("../tests/helpers");
const { createTeacher } = await import("../src/seed");

const database = await setupTestDb();
await createTeacher(database, { name: "Guru", email: "guru@cek.id", password: "rahasia123", classroom: "Kelas 1" });
const teacher = (await api().post("/api/auth/teacher/login").send({ email: "guru@cek.id", password: "rahasia123" })).body.token;
const student = (await api().post("/api/students").set(bearer(teacher)).send({ nickname: "Raka", picturePassword: [2, 5, 8] })).body;
const kid = (await api().post("/api/auth/student/login").set(bearer(teacher)).send({ studentId: student.id, picturePassword: [2, 5, 8] })).body.token;

let failures = 0;
const report = (step: string, source: string, detail: string) => {
  const ok = source === "ai";
  if (!ok) failures += 1;
  console.log(`${ok ? "OK      " : "FALLBACK"}  ${step.padEnd(28)} ${detail}`);
};

const map = (await api().get("/api/levels").set(bearer(kid))).body;
report("peta petualangan", map[0].source, `${map.length} level, level 1 = ${map[0].status}`);

const plan = [
  ["t1-a", true, 0.9],
  ["t1-a", true, 0.85],
  ["t1-i", false, 0.3],
  ["t1-i", true, 0.6],
] as const;
for (const [itemId, berhasil, kemiripan] of plan) {
  const res = await api()
    .post("/api/attempts")
    .set(bearer(kid))
    .send({ itemId, berhasil, langkah_tercapai: berhasil ? 1 : 0, durasi_ms: 1500, kemiripan });
  report(
    `percobaan ${itemId} ${berhasil ? "berhasil" : "gagal"}`,
    res.body.source,
    `${res.body.stars} bintang, +${res.body.pointsEarned} poin, berikutnya ${res.body.next?.item?.id}`,
  );
}

const insight = (await api().get(`/api/ai/students/${student.id}/insight`).set(bearer(teacher))).body;
report("ringkasan anak (guru)", insight.source, `${insight.summary.slice(0, 90)}  [saran: ${insight.adviceWriter}]`);

const cls = (await api().get("/api/ai/class/insight").set(bearer(teacher))).body;
report("ringkasan kelas (guru)", cls.source, `${cls.summary.slice(0, 90)}  [${cls.writer}]`);

const tasks = (await api().get(`/api/ai/students/${student.id}/suggested-homework`).set(bearer(teacher))).body;
report("usulan PR", tasks.source, `${tasks.items.map((i: { item: string }) => i.item).join(", ")}  [${tasks.writer}]`);

const history = (await api().get(`/api/ai/students/${student.id}/history`).set(bearer(teacher))).body;
report("riwayat", history.source, `${history.daily.length} hari`);

const ask = (await api().post(`/api/ai/students/${student.id}/ask`).set(bearer(teacher)).send({ question: "Bunyi apa yang paling sulit untuk Raka?" })).body;
report("tanya AI (guru)", ask.source, `${String(ask.answer).slice(0, 90)}  [${ask.writer}]`);

const invite = (await api().post("/api/parents/invites").set(bearer(teacher)).send({ parentName: "Ibu Sari", studentIds: [student.id] })).body;
const parent = (await api().post(`/api/invites/${invite.inviteToken}/accept`).send({ email: "ibu@cek.id", password: "rahasia123" })).body.token;
const report7 = (await api().get(`/api/parent/children/${student.id}/weekly-report`).set(bearer(parent))).body;
report("laporan mingguan (ortu)", report7.source, `${String(report7.practising).slice(0, 80)}  [${report7.writer}]`);

console.log(failures ? `\n${failures} langkah memakai cadangan` : "\nSemua langkah dijawab layanan AI");
await database.close();
process.exit(failures ? 1 : 0);

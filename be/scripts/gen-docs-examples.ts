/**
 * Builds the request/response examples shown on /docs by running the whole flow against a
 * throwaway in-memory Postgres (PGlite). Examples are real API output, never hand-written.
 *
 *   npm run docs:examples      -> writes src/docs/examples.json
 *
 * Re-run after changing an endpoint. Fails if any endpoint has no example.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// Settings must exist before the app modules read them.
Object.assign(process.env, {
  DATABASE_URL: "postgres://unused",
  JWT_SECRET: "docs-example-secret-key-with-32-characters!!",
  PASSWORD_BCRYPT_ROUNDS: "4",
  PICTURE_BCRYPT_ROUNDS: "4",
  WEB_URL: "https://satu.example",
  INVITE_URL: "satu://undangan",
});

// Answers shaped like the real ML service (recorded in tests/fixtures/ml.json); also sets AI_URL.
const { fakeMl } = await import("../tests/fake-ml");
await fakeMl.start();

const { setupTestDb, api } = await import("../tests/helpers");
const { createTeacher } = await import("../src/seed");
const { registry } = await import("../src/lib/route");

type Example = { request?: unknown; status: number; response: unknown };
const examples: Record<string, Example> = {};

const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const shorten = (value: unknown) =>
  JSON.parse(JSON.stringify(value ?? null).replace(JWT, (t) => `${t.slice(0, 20)}...`));

/** Calls one endpoint, records it under "method path" (the route pattern), returns the body. */
async function call(
  method: "get" | "post" | "put" | "patch",
  pattern: string,
  url: string,
  token?: string,
  body?: unknown,
) {
  let req = api()[method](`/api${url}`);
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  const res = body === undefined ? await req : await req.send(body as object);
  if (res.status >= 400) throw new Error(`${method} ${url} -> ${res.status} ${JSON.stringify(res.body)}`);
  examples[`${method} ${pattern}`] = { request: body, status: res.status, response: shorten(res.body) };
  return res.body;
}

const database = await setupTestDb();
await createTeacher(database, { name: "Bu Rina", email: "guru@satu.id", password: "gurusatu!", classroom: "Kelas 1" });

// ---- Guru: login, buat akun anak (form -> halaman PIN -> satu request)
const login = await call("post", "/auth/teacher/login", "/auth/teacher/login", undefined, {
  email: "guru@satu.id",
  password: "gurusatu!",
});
const guru = login.token as string;
const raka = await call("post", "/students", "/students", guru, {
  nickname: "Raka",
  parentWhatsapp: "081234567890",
  photoUrl: "https://contoh.id/foto/raka.jpg",
  picturePassword: [2, 5, 8],
});
const sinta = (await api()
  .post("/api/students")
  .set("Authorization", `Bearer ${guru}`)
  .send({ nickname: "Sinta", picturePassword: [1, 1, 4] })).body;
await call("get", "/classrooms", "/classrooms", guru);
await call("post", "/classrooms", "/classrooms", guru, { name: "Kelas B" });
await call("patch", "/students/:id", `/students/${raka.id}`, guru, {
  photoUrl: "https://contoh.id/foto/raka-baru.jpg",
});
await call("put", "/students/:id/picture-password", `/students/${raka.id}/picture-password`, guru, {
  picturePassword: [2, 5, 8],
});
await call("put", "/students/:id/level", `/students/${raka.id}/level`, guru, { maxLevel: 3 });
await call("post", "/students/:id/unlock", `/students/${raka.id}/unlock`, guru);

// ---- Web anak (laptop kelas memakai token guru)
await call("get", "/classroom/students", "/classroom/students", guru);
const kidLogin = await call("post", "/auth/student/login", "/auth/student/login", guru, {
  studentId: raka.id,
  picturePassword: [2, 5, 8],
});
const kid = kidLogin.token as string;
await call("put", "/me/calibration", "/me/calibration", kid, {
  versi: 1,
  kelas: ["a", "i", "u"],
  pusat: [[0.41, 0.05, 0.02, 0, 0.3], [0.12, 0.02, 0.18, 0, 0.1], [0.1, 0.52, 0, 0, 0.1]],
  skala: [0.08, 0.08, 0.08, 0.05, 0.08],
  jumlah: [6, 6, 6],
  akurasi: 0.91,
});
await call("get", "/me/calibration", "/me/calibration", kid);
await call("get", "/levels", "/levels", kid);
const mata = (itemId: string, berhasil: boolean, kemiripan: number) => ({
  itemId, berhasil, langkah_tercapai: berhasil ? 1 : 0, durasi_ms: 1800, kemiripan,
});
await api().post("/api/attempts").set("Authorization", `Bearer ${kid}`).send(mata("t1-a", false, 0.4));
await api().post("/api/attempts").set("Authorization", `Bearer ${kid}`).send(mata("t1-i", true, 0.6));
await call("post", "/attempts", "/attempts", kid, mata("t1-a", true, 0.92));
await call("get", "/me/student", "/me/student", kid);
const shop = await call("get", "/rewards", "/rewards", kid);
const sticker = (shop.catalog ?? shop.rewards ?? []).find((r: { name: string }) => r.name === "Stiker bintang");
await call("post", "/rewards/:id/redeem", `/rewards/${sticker.id}/redeem`, kid);

// ---- Guru: undang orang tua
const invite = await call("post", "/parents/invites", "/parents/invites", guru, {
  parentName: "Ibu Sari",
  studentIds: [raka.id],
});
const pending = (await api()
  .post("/api/parents/invites")
  .set("Authorization", `Bearer ${guru}`)
  .send({ parentName: "Ayah Sinta", studentIds: [sinta.id] })).body;
await call("post", "/parents/:id/invites", `/parents/${pending.parent.id}/invites`, guru);

// ---- Aplikasi orang tua: buka undangan, aktivasi, login
await call("get", "/invites/:token", `/invites/${invite.inviteToken}`);
await call("post", "/invites/:token/accept", `/invites/${invite.inviteToken}/accept`, undefined, {
  email: "ibu.sari@gmail.com",
  password: "rahasiaSari1",
});
const parentLogin = await call("post", "/auth/parent/login", "/auth/parent/login", undefined, {
  email: "ibu.sari@gmail.com",
  password: "rahasiaSari1",
});
const ortu = parentLogin.token as string;
await call("get", "/parents", "/parents", guru);

// ---- Guru: monitoring, AI, PR
await call("get", "/dashboard/class", "/dashboard/class", guru);
await call("get", "/dashboard/students/:id", `/dashboard/students/${raka.id}`, guru);
await call("get", "/dashboard/students/:id/chart", `/dashboard/students/${raka.id}/chart`, guru);
await call("get", "/dashboard/class/sounds", "/dashboard/class/sounds", guru);
await call("get", "/ai/class/insight", "/ai/class/insight", guru);
await call("get", "/ai/class/suggested-homework", "/ai/class/suggested-homework", guru);
await call("get", "/ai/students/:id/insight", `/ai/students/${raka.id}/insight`, guru);
await call("get", "/ai/students/:id/history", `/ai/students/${raka.id}/history`, guru);
await call("post", "/ai/students/:id/ask", `/ai/students/${raka.id}/ask`, guru, {
  question: "Bunyi apa yang paling sulit untuk Raka?",
});
const suggestion = await call(
  "get", "/ai/students/:id/suggested-homework", `/ai/students/${raka.id}/suggested-homework`, guru,
);
const items = (suggestion.items as { levelId: string; item: string }[]).slice(0, 2).map(({ levelId, item }) => ({ levelId, item }));
await call("post", "/homework/batch", "/homework/batch", guru, {
  assignments: [{ studentId: sinta.id, items }],
  note: "Usulan AI disetujui",
});
await call("post", "/homework", "/homework", guru, {
  studentId: raka.id,
  dueDate: new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10),
  note: "Latihan 10 menit sebelum tidur",
  items,
});

// ---- Orang tua: anak, PR, latihan di rumah, streak, progres
await call("get", "/parent/children", "/parent/children", ortu);
const hw = await call("get", "/parent/children/:id/homework", `/parent/children/${raka.id}/homework`, ortu);
const home = await call("post", "/parent/children/:id/practice-token", `/parent/children/${raka.id}/practice-token`, ortu);
for (const item of hw[0].items) {
  await api()
    .post("/api/attempts")
    .set("Authorization", `Bearer ${home.token}`)
    .send({ ...mata(item.item, true, 0.85), homeworkItemId: item.id });
}
await call("get", "/parent/children/:id/streak", `/parent/children/${raka.id}/streak`, ortu);
await call("get", "/parent/children/:id/progress", `/parent/children/${raka.id}/progress`, ortu);
await call("get", "/parent/children/:id/chart", `/parent/children/${raka.id}/chart`, ortu);
await call("get", "/parent/children/:id/weekly-report", `/parent/children/${raka.id}/weekly-report`, ortu);
await call("post", "/parent/children/:id/ask", `/parent/children/${raka.id}/ask`, ortu, {
  question: "Apa yang bisa kami latih di rumah?",
});
await call("get", "/homework/submissions", "/homework/submissions", guru);

// ---- Guru: hadiah
await call("get", "/teacher/rewards", "/teacher/rewards", guru);
await call("post", "/teacher/rewards", "/teacher/rewards", guru, { name: "Krayon", costPoints: 50, stock: 20 });
const redemptions = await call("get", "/teacher/redemptions", "/teacher/redemptions", guru);
await call("post", "/teacher/redemptions/:id/give", `/teacher/redemptions/${redemptions[0].id}/give`, guru);

// ---- Every registered endpoint must have an example
const missing = registry.map((r) => `${r.method} ${r.path}`).filter((key) => !examples[key]);
if (missing.length) throw new Error(`Belum ada contoh untuk: ${missing.join(", ")}`);

const out = path.resolve(import.meta.dirname, "../src/docs/examples.json");
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(examples, null, 2)}\n`);
console.log(`${Object.keys(examples).length} contoh ditulis ke src/docs/examples.json`);
await database.close();
await fakeMl.stop();

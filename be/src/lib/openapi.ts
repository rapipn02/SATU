import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { registry, TAGS } from "./route";

const toSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });

/** What `{id}` means for a path, shown next to the field on /docs. */
function idDescription(path: string): string {
  const where: [RegExp, string][] = [
    [/^\/(students|dashboard\/students|ai\/students|parent\/children)\//, "Id anak (UUID), dari GET /classroom/students atau GET /parent/children"],
    [/^\/parents\//, "Id orang tua (UUID), dari GET /parents"],
    [/^\/(rewards|teacher\/rewards)\//, "Id hadiah (UUID), dari GET /rewards"],
    [/^\/teacher\/redemptions\//, "Id penukaran hadiah (UUID), dari GET /teacher/redemptions"],
  ];
  return where.find(([re]) => re.test(path))?.[1] ?? "UUID";
}

type Example = { request?: unknown; status: number; response: unknown };

/** Real request/response pairs recorded by `npm run docs:examples` (scripts/gen-docs-examples.ts). */
function loadExamples(): Record<string, Example> {
  const file = new URL("../docs/examples.json", import.meta.url);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

const GUIDE = `
API untuk **SATU (Sahabat Tunarungu)**. Satu backend dipakai oleh 3 aplikasi; endpoint dikelompokkan per aplikasi di bawah.

### Cara pakai halaman ini
1. Buka endpoint **login** di kotak aplikasimu, klik **Try it out**, isi body, lalu **Execute**.
2. Salin nilai \`token\` dari respons.
3. Klik tombol **Authorize** (gembok, kanan atas), tempel token (tanpa kata "Bearer"), **Authorize**.
4. Sekarang endpoint lain bisa dicoba. Token tersimpan walau halaman di-refresh.

### Aturan umum
| | |
|---|---|
| Alamat | \`{BASE_URL}/api/...\`, BASE_URL dari pemilik backend |
| Header login | \`Authorization: Bearer <token>\` |
| Format | JSON, nama field **camelCase**, tanggal \`YYYY-MM-DD\` (WIB), waktu ISO 8601 |
| Masa berlaku token | guru 7 hari · orang tua 30 hari · anak 3 jam · perangkat kelas 90 hari |
| Data "live" | polling tiap 5 detik (tidak ada WebSocket) |

### Format error (semua endpoint)
\`\`\`json
{ "detail": "Data tidak valid", "errors": [{ "path": "picturePassword", "message": "Pilih tepat 3 gambar" }] }
\`\`\`
| Status | Arti |
|---|---|
| 400 | Data tidak valid (lihat \`errors\`) |
| 401 | Belum login / token salah / password salah |
| 403 | Peran salah (mis. token anak ke endpoint guru) atau akun anak terkunci |
| 404 | Tidak ada, **atau bukan milikmu** (anak kelas lain, anak orang lain) |
| 409 | Bentrok: email sudah dipakai, nama kelas kembar, stok habis |
| 429 | Terlalu banyak login gagal, tunggu 15 menit |

### Mengirim hasil latihan (Mata → backend)
\`POST /attempts\` menerima keluaran komponen Mata apa adanya + \`itemId\`:
\`{ "itemId": "t1-a", "berhasil": true, "langkah_tercapai": 1, "durasi_ms": 1800, "kemiripan": 0.92 }\`.
Bintang dihitung **server**; \`bintang\`/\`poin\` kiriman klien diabaikan. **Benar** = \`berhasil\` dan kemiripan ≥ 0,5.
Di bawah 0,5 → 0 bintang dan 0 poin (anak mengulang, tanpa pop up) · 0,5–0,69 → 1 bintang · 0,7–0,89 → 2 bintang · ≥ 0,9 → 3 bintang. Poin = bintang × 10 (10 / 20 / 30) tiap percobaan.
Jawaban memuat \`correct\`, \`accuracy\` (persen), dan \`next\` (item berikutnya dari AI).
Field \`source\` di jawaban AI: \`"ai"\` = dijawab layanan AI, \`"fallback"\` = aturan cadangan (layanan AI mati/lambat).

### PIN gambar anak
9 gambar bernomor **tetap 1–9** (nomor melekat ke gambar, bukan posisi di layar): 1 bintang, 2 matahari, 3 kilau,
4 puzzle, 5 mobil, 6 bulan, 7 robot, 8 kincir, 9 kuda goyang. Anak/guru mengetuk 3 kali, urutan menentukan →
kirim \`"picturePassword": [2, 5, 8]\`. **Gambar yang sama boleh dipilih lagi**, mis. \`[1, 1, 1]\` = bintang tiga kali.
Salah 5× → akun anak terkunci; web anak menampilkan "Minta Bantuan Guru"
dan terbuka sendiri begitu guru membuka kunci / ganti PIN.

### Level dan bintang
- **Level terbuka** kalau level sebelumnya sudah ≥ 1 bintang (aturan hackathon; pembukaan dari penguasaan AI dimatikan).
  Level dengan bintang terbaik 3 = \`"tuntas"\`. Field \`source\` di peta = \`"stars"\`.
- **Batas level guru:** \`PUT /students/{id}/level\` \`{ "maxLevel": 1–6 | null }\`. Level sampai batas terbuka, di atasnya
  terkunci (\`lockedByTeacher: true\`). \`null\` = kembali ke aturan bintang.
- **Tanda selesai** di aplikasi = \`bestStars\` per item (0–3) di \`levels[].items[]\`. Jangan pakai \`cleared\`/\`canDo\`
  untuk itu: keduanya penguasaan menurut AI (baru centang setelah konsisten benar, ≥ 85%), untuk laporan perkembangan.
- **Usulan PR** (\`suggested-homework\`) tidak pernah berisi latihan yang sudah 3 bintang atau yang levelnya terkunci untuk
  anak itu; kekurangannya diisi latihan peta yang belum selesai.
- **PR selesai otomatis:** latihan benar (≥ 1 bintang) pada item PR yang masih terbuka dihitung untuk PR itu, walau
  dikerjakan dari peta tanpa \`homeworkItemId\`.

### Video tutorial
Tiap latihan yang punya video membawa \`tutorialUrl\` (MP4, H.264, tanpa token), mis.
\`https://tunarungu.neotelemetri.id/tutorial/t1-a.mp4\`; \`null\` kalau belum ada. Ada di item peta (\`GET /levels\`,
\`GET /parent/children/{id}/progress\`) dan di item PR (\`GET /parent/children/{id}/homework\`, \`/homework/submissions\`).
Putar diulang tanpa suara.

### Token perangkat kelas (web anak)
Laptop kelas tidak login guru. Pemilik server membuat token khusus: \`npm run device-token -- --email <guru>\`.
Token ini hanya boleh \`GET /classroom/students\` (kelasnya sendiri) dan \`POST /auth/student/login\`; endpoint lain → 403.
`;

const TAG_DESCRIPTIONS: Record<string, string> = {
  [TAGS.guru]:
    "**Dipakai teman mobile (aplikasi guru).** Alur: login (dapat daftar `classrooms`) → pilih/tambah kelas " +
    "(`GET/POST /classrooms`) → buat akun anak (`POST /students`, PIN 3 gambar, boleh berulang; jawaban memuat " +
    "`invite.inviteUrl` = link orang tua, cukup disalin) → kendali anak (reset PIN, buka kunci, batas level " +
    "`PUT /students/{id}/level`) → pantau kelas, tabel bunyi (`GET /dashboard/class/sounds`) & report anak → " +
    "usulan PR AI sekelas → Setuju Semua (`POST /homework/batch`) → hasil PR → hadiah. " +
    "Endpoint kelas menerima `?classroomId=` (kosong = kelas pertama).",
  [TAGS.ortu]:
    "**Dipakai teman mobile (aplikasi orang tua).** Aktivasi sekali: orang tua menempel link dari guru, aplikasi " +
    "mengambil token (teks setelah `/` terakhir) → `GET /invites/{token}` untuk sapaan → `POST /invites/{token}/accept` " +
    "(email + sandi, langsung dapat token). Berikutnya login biasa `POST /auth/parent/login`. Lalu: anak, PR beserta " +
    "video tutorial (`tutorialUrl`), streak, progres (`bestStars`), laporan mingguan AI, tanya AI.",
  [TAGS.anak]:
    "**Dipakai web anak di laptop sekolah.** Laptop memakai token perangkat kelas (tanpa login guru) → pilih karakter " +
    "→ PIN 3 gambar → token anak → peta petualangan (4 kategori, level terbuka dari bintang) → Mari Berlatih " +
    "(kamera Mata + video tutorial) → `POST /attempts` → pop up bintang & poin.",
};

/** OpenAPI 3.1 document built from the route registry, so /docs never drifts from the code. */
export function openApiDocument() {
  const examples = loadExamples();
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of registry) {
    const path = `/api${route.path.replace(/:(\w+)/g, "{$1}")}`;
    const example = examples[`${route.method} ${route.path}`];
    const status = String(route.status ?? 200);
    const pathParams = [...route.path.matchAll(/:(\w+)/g)].map((match) => ({
      name: match[1],
      in: "path",
      required: true,
      schema: { type: "string" },
      description: match[1] === "token" ? "Token dari link undangan" : idDescription(route.path),
    }));
    const queryParams = route.query
      ? Object.entries((toSchema(route.query).properties ?? {}) as Record<string, unknown>).map(([name, schema]) => ({
          name,
          in: "query",
          schema,
        }))
      : [];

    (paths[path] ??= {})[route.method] = {
      tags: Array.isArray(route.tag) ? route.tag : [route.tag],
      summary: route.summary,
      operationId: `${route.method}${route.path.replace(/[/:-](\w)/g, (_, c: string) => c.toUpperCase())}`,
      description: route.auth ? `🔒 Butuh token **${[route.auth].flat().join(" / ")}**.` : "🔓 Tanpa login.",
      ...(route.auth ? { security: [{ bearer: [] }] } : {}),
      parameters: [...pathParams, ...queryParams],
      ...(route.body
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: toSchema(route.body),
                  ...(example?.request !== undefined ? { example: example.request } : {}),
                },
              },
            },
          }
        : {}),
      responses: {
        [status]: {
          description: "Berhasil",
          ...(example ? { content: { "application/json": { example: example.response } } } : {}),
        },
        default: { $ref: "#/components/responses/Error" },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: { title: "SATU API", version: "0.2.0", description: GUIDE },
    tags: Object.values(TAGS).map((name) => ({ name, description: TAG_DESCRIPTIONS[name] })),
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      responses: {
        Error: {
          description: "Gagal (lihat tabel status di atas)",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["detail"],
                properties: {
                  detail: { type: "string" },
                  errors: {
                    type: "array",
                    items: { type: "object", properties: { path: { type: "string" }, message: { type: "string" } } },
                  },
                },
              },
              example: { detail: "Peran ini tidak boleh mengakses endpoint ini" },
            },
          },
        },
      },
    },
    paths,
  };
}

/** Each app's group drawn as its own card on /docs. */
export const DOCS_CSS = `
  .swagger-ui .topbar { display: none }
  .swagger-ui .info { margin: 24px 0 }
  .swagger-ui .opblock-tag-section {
    border: 2px solid #e5e7eb; border-radius: 14px; padding: 4px 16px 12px; margin: 0 0 24px; background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,.06);
  }
  .swagger-ui .opblock-tag-section:has(h3[data-tag="${TAGS.guru}"]) { border-color: #f59e0b; background: #fffbeb }
  .swagger-ui .opblock-tag-section:has(h3[data-tag="${TAGS.ortu}"]) { border-color: #10b981; background: #ecfdf5 }
  .swagger-ui .opblock-tag-section:has(h3[data-tag="${TAGS.anak}"]) { border-color: #3b82f6; background: #eff6ff }
  .swagger-ui .opblock-tag { font-size: 22px; border-bottom: none }
  .swagger-ui .opblock-tag small { display: block; margin-top: 6px; font-size: 13px; line-height: 1.5 }
  .swagger-ui table { margin: 8px 0 }
`;

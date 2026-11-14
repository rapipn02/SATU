# SATU — Backend (Express + TypeScript + Supabase)

Satu backend untuk tiga klien: **web sekolah** (anak), **web orang tua**, dan **aplikasi guru** (mobile).
Dokumentasi semua endpoint: **`/docs`** (Swagger, klik **Authorize** lalu tempel token).

## Menjalankan

```bash
npm install
cp .env.example .env          # isi DATABASE_URL (Supabase Session pooler) dan JWT_SECRET
npm run migrate               # buat tabel + isi level (sekali)
npm run seed -- --email guru@sekolah.id --password "minimal8karakter" --name "Bu Rina" --class "Kelas 1"
npm run dev                   # http://localhost:3000/docs
```

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server dengan auto-reload |
| `npm start` | Server tanpa reload (deploy) |
| `npm run migrate` | Jalankan `supabase/migrations/*.sql` yang belum pernah dijalankan |
| `npm run seed -- ...` | Buat akun guru + kelas + katalog hadiah awal |
| `npm test` | Test API (Postgres asli di dalam proses lewat PGlite; tidak butuh Supabase) |
| `npm run check` | Cek tipe TypeScript |

## Struktur

```
src/
  app.ts            express: CORS, JSON, /api, /docs, error handler
  server.ts         koneksi Supabase + listen
  config.ts         env (divalidasi zod)
  db.ts             node-postgres; transaksi; tanggal WIB
  routes.ts         SEMUA endpoint di satu tempat: method, path, peran, skema body
  schemas.ts        validasi request (zod)
  lib/route.ts      helper: cek token + peran, validasi, otomatis masuk /docs
  lib/errors.ts     AppError -> { detail }, terjemahan error SQL
  lib/security.ts   JWT, bcrypt, token undangan (SHA-256)
  services/         logika per domain: accounts, parents, practice, homework, dashboard, ai, rewards
supabase/
  migrations/       skema + fungsi record_attempt & redeem_reward + isi level
tests/              alur API per peran (vitest + supertest)
```

Menambah endpoint: tulis logika di `services/`, skema di `schemas.ts`, daftarkan di `routes.ts`. Otomatis muncul di `/docs`.

## Aturan API (untuk teman mobile & frontend)

- Login mengembalikan `{ token, role, ... }`. Request berikutnya: `Authorization: Bearer <token>`.
- Error selalu `{ "detail": "pesan" }` (+ `errors` untuk validasi). Status: 400 data salah, 401 belum login,
  403 peran salah / akun terkunci, 404 tidak ada atau bukan milikmu, 409 bentrok (email dipakai, stok habis).
- Semua JSON memakai camelCase. Tanggal `YYYY-MM-DD` (WIB), waktu ISO 8601.
- Dashboard di HP guru: polling tiap 5 detik.

## Alur utama

| Siapa | Langkah | Endpoint |
|---|---|---|
| Laptop kelas | Guru login (mode kelas) | `POST /api/auth/teacher/login` |
| Guru (HP) | Buat akun anak: nama, WA ortu, foto → halaman berikut pilih PIN 3 gambar | `POST /api/students` |
| Guru (HP) | Ganti PIN anak yang lupa | `PUT /api/students/:id/picture-password` |
| Anak | Pilih profil → 3 gambar | `GET /api/classroom/students`, `POST /api/auth/student/login` |
| Anak | Peta (6 level, 98 item) → latihan dengan Mata → bintang | `GET /api/levels`, `POST /api/attempts` |
| Anak | Simpan / muat model bibir personal | `PUT` dan `GET /api/me/calibration` |
| Anak | Toko hadiah | `GET /api/rewards`, `POST /api/rewards/:id/redeem` |
| Guru (HP) | Undang orang tua: nama + anak → link WA | `POST /api/parents/invites` |
| Orang tua | Buka link → Gmail + sandi → masuk | `GET /api/invites/:token`, `POST /api/invites/:token/accept` |
| Guru (HP) | Monitoring kelas & anak | `GET /api/dashboard/class`, `GET /api/dashboard/students/:id` |
| Guru (HP) | Ringkasan AI, usulan PR, riwayat, tanya AI, kirim PR | `GET /api/ai/...`, `POST /api/ai/students/:id/ask`, `POST /api/homework` |
| Orang tua | PR + latihan di rumah + streak | `GET /api/parent/children/:id/homework`, `POST .../practice-token`, `GET .../streak` |
| Orang tua | Laporan mingguan (AI), tanya AI | `GET .../weekly-report`, `POST .../ask` |
| Guru (HP) | Hasil PR | `GET /api/homework/submissions` |

### Kelas, link orang tua, tabel bunyi, PR sekelas

- **Banyak kelas:** `GET/POST /api/classrooms`. Login guru mengembalikan `classrooms`. Endpoint kelas menerima
  `classroomId` opsional (query, atau body untuk `POST /students`); tanpa itu dipakai kelas pertama.
  `classroomId` milik guru lain → 404.
- **Link orang tua:** `POST /api/students` (opsional `parentName`, `classroomId`) mengembalikan
  `invite: { inviteToken, inviteUrl, expiresAt }`. Guru cukup menyalin `inviteUrl` (sekali pakai, 7 hari).
  Buat ulang: `POST /api/parents/:id/invites`.
- **Tabel kelas + laporan anak:** `GET /api/dashboard/class/sounds` → `{ sounds, students: [{ id, nickname, photoUrl,
  status, cleared, canDo, source }] }`. `cleared.a === true` = centang. `status`: `sudah_bisa | hampir_bisa |
  sedang_dilatih | belum_dilatih`. Sumber `ai` (peta ML); `fallback` dari progres item (t2 ≥ 2 bintang = bisa).
  `GET /api/dashboard/students/:id` juga memuat `status`, `cleared`, `canDo`, `practiceDays7`.
- **PR dari AI, guru setuju:** `GET /api/ai/class/suggested-homework` (usulan per anak) →
  `POST /api/homework/batch { assignments: [{ studentId, items }], dueDate?, note? }` ("Setuju Semua",
  semua atau tidak sama sekali).
- **Batas level dari guru:** `PUT /api/students/:id/level { maxLevel: 1-6 | null }`. Level di atas batas terkunci
  di akun anak (`GET /levels` → `status: "terkunci"`, `lockedByTeacher: true`; `POST /attempts` ke item level itu → 400,
  dan item berikutnya tidak pernah di level terkunci). Level sampai batas terbuka walau AI belum membukanya.
  `null` = ikuti AI. PR yang guru kirim tetap boleh ke level mana pun. Nilai ada di `student.maxLevel` pada detail anak.
  **Butuh migrasi `005_teacher_level_cap.sql`.**
- **Grafik:** `GET /api/ai/students/:id/history` → `daily: [{ date, attempts, successes, rate }]`
  (**berubah** dari `tanggal/percobaan/berhasil`), `rate` 0–100.

**Latihan di rumah:** `practice-token` memberi token anak bertanda `home`. Web orang tua memakai endpoint
`/api/levels` dan `/api/attempts` yang sama. Untuk PR, kirim `homeworkItemId`.

## Aturan permainan

- **Kurikulum milik layanan AI** (teman ML): 6 level, 98 item. Level: 1 vokal a/i/u, 2 vokal e/o, 3 konsonan bibir,
  4 hembusan/desis/huruf lidah, 5 suku kata, 6 kata. Id level `level-1`…`level-6`, id item dari ML (`t1-a`, `t3-ma`, `t4-bola`).
  Tabel `levels` diisi dari ML dengan `npm run sync:curriculum` (migrasi `004`).
- **Percobaan** dikirim dalam bentuk keluaran Mata (`HasilPercobaan`) + `itemId`:
  `{ itemId, berhasil, langkah_tercapai, durasi_ms, kemiripan }` (`bintang`/`poin` dari klien diabaikan).
- **Bintang 1–3** dihitung server. **Benar** = `berhasil` dan akurasi (`kemiripan`) ≥ 50%. Belum benar (akurasi di bawah 50%)
  = 0 bintang, 0 poin, anak mengulang tanpa pop up; akurasi 50–69% = 1 bintang, 70–89% = 2 bintang, 90–100% = 3 bintang. Jawaban memuat `correct` dan `accuracy`.
  Percobaan yang belum benar tidak dihitung berhasil (streak, PR, penguasaan di layanan AI). Ambang ada di `src/lib/stars.ts`.
- **Poin = bintang × 10 tiap percobaan** (10 / 20 / 30). Butuh migrasi `006_points_per_attempt.sql`.
  Mengulang item yang sama menambah poin lagi.
- **Level terbuka/terkunci** ditentukan **bintang saja** (aturan hackathon): level terbuka kalau level sebelumnya
  sudah ≥ 1 bintang; level dengan bintang terbaik 3 berstatus `tuntas`. Pembukaan level dari penguasaan AI (BKT ≥ 40%)
  dimatikan, tapi layanan AI tetap dipakai untuk item berikutnya, laporan, status bunyi, dan usulan PR.
  Batas level guru (`maxLevel`) tetap berlaku di atas aturan ini. PR boleh menargetkan level yang belum terbuka.
  Field `source` di peta bernilai `"stars"`.
- **Streak:** percobaan **berhasil** ke-`STREAK_MIN_PRACTICES` (default 3) pada hari itu (WIB). Percobaan gagal tidak dihitung.
  Bolong sehari → mulai dari 1. Saat ditampilkan, streak yang terakhir aktif sebelum kemarin = 0.
- **PR:** sebuah item PR selesai hanya oleh percobaan **berhasil** dengan bintang ≥ `requiredStars`.
- **PIN gambar:** 9 gambar bernomor tetap **1–9**; anak mengetuk 3 kali (boleh berulang, urutan menentukan),
  kirim `picturePassword: [a, b, c]`. Nomor milik gambarnya, bukan posisi di layar: semua aplikasi wajib memakai
  9 gambar dan nomor yang sama. Salah 5× → terkunci sampai guru `POST /api/students/:id/unlock` atau ganti PIN.
- **Nomor WA orang tua** boleh `0812…`, `+62 812…`, atau `62812…`; disimpan `62812…`. Link undangan WhatsApp
  langsung ke nomor itu. Respons undangan juga berisi `inviteToken` untuk aplikasi orang tua.
- **Login guru/orang tua:** 10× salah dalam 15 menit → 429 sementara.
- **Undangan orang tua:** link sekali pakai, berlaku 7 hari; guru bisa membuat ulang (link lama hangus).

## Layanan AI (teman ML)

Layanan FastAPI di `aisatu-main/backend`. Di VPS ia hanya didengarkan di `127.0.0.1:8000` (belum punya login,
jangan dibuka ke internet); backend memanggilnya lewat `AI_URL=http://127.0.0.1:8000/ai`.

| Kapan | Panggilan ke layanan AI |
|---|---|
| Anak login / token latihan rumah | `POST /anak/{id}/sesi` |
| Tiap percobaan | `POST /anak/{id}/percobaan` `{item_id, berhasil, langkah_tercapai, durasi_ms}` → `berikutnya`, `lelah`, `perubahan` |
| Peta petualangan | `GET /anak/{id}/level` |
| Ringkasan anak | `GET /anak/{id}/peta` + `POST /anak/{id}/saran-belajar` |
| Ringkasan kelas | `POST /kelas/ringkasan` |
| Usulan PR | `POST /anak/{id}/tugas-usulan` |
| Riwayat, tanya, laporan mingguan | `GET .../riwayat`, `POST .../tanya`, `POST .../laporan-mingguan` |
| Model bibir personal | `PUT /anak/{id}/model-bibir` |

Id anak di layanan AI = id siswa di Supabase. Semua panggilan **best effort**: kalau layanan AI belum diisi,
mati, lambat (5 detik; 20 detik untuk yang memakai LLM), atau balasannya berbeda bentuk, backend memakai
**aturan cadangan** dan field `source` di respons berisi `fallback` (bukan `ai`).

**Status anak di layanan AI disimpan di memori** (hilang saat ia restart). Backend memulihkannya otomatis: kalau
`/level` menunjukkan anak kosong padahal punya percobaan di Supabase, 200 percobaan terakhir dikirim ulang
(tanggal asli hilang). Hapus perilaku ini kalau teman ML sudah menyimpan status ke database.

Cek sambungan ke layanan AI yang **sungguhan**: jalankan `uvicorn main:app --port 8000` di `aisatu-main/backend`,
lalu `AI_URL=http://127.0.0.1:8000/ai npm run check:ai`. Semua langkah harus berlabel `OK` (dijawab AI).

## Belum / catatan

- Kata-kata kurikulum dari layanan AI (`satu_ai/kurikulum.py`) belum dicocokkan dengan buku guru; setelah ML mengubahnya,
  jalankan `npm run sync:curriculum` dan buat migrasi baru (jangan mengedit `004` yang sudah dijalankan).
- Test memakai layanan AI palsu (`tests/fake-ml.ts`, jawabannya direkam dari layanan sungguhan di `tests/fixtures/ml.json`).
- Foto anak disimpan sebagai URL/data URL (maks ±700 KB); pindahkan ke Supabase Storage jika perlu.

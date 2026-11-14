# SATU API — panduan untuk aplikasi Guru dan Orang Tua (mobile)

Base URL: `https://tunarungu.neotelemetri.id/api`
Dokumentasi interaktif (kalau mau mencoba): `https://tunarungu.neotelemetri.id/docs`

## Aturan umum

| | |
|---|---|
| Header setelah login | `Authorization: Bearer <token>` |
| Format | JSON. Nama field camelCase. Tanggal `YYYY-MM-DD` (WIB), waktu ISO 8601 |
| Masa berlaku token | guru 7 hari, orang tua 30 hari. Kalau 401, login ulang |
| Logout | Hapus token di aplikasi. Tidak ada endpoint logout |
| Data "live" | Polling tiap 5 detik. Tidak ada WebSocket |

**Format error** (semua endpoint):
```json
{ "detail": "Data tidak valid", "errors": [{ "path": "picturePassword", "message": "Pilih tepat 3 gambar" }] }
```
| Status | Arti |
|---|---|
| 400 | Data tidak valid, lihat `errors` |
| 401 | Belum login, token kedaluwarsa, atau sandi salah |
| 403 | Peran salah (mis. token orang tua ke endpoint guru) |
| 404 | Tidak ada, **atau bukan milikmu** (anak/kelas guru lain) |
| 409 | Bentrok: email sudah dipakai, nama kelas kembar, stok habis |
| 429 | Terlalu banyak login gagal, tunggu 15 menit |

**Field `source` di jawaban AI:** `"ai"` = dijawab layanan AI, `"fallback"` = aturan cadangan (AI sedang tidak tersedia). Tampilan sama; boleh abaikan.
**Field `writer`:** `"llm"` atau `"templat"` = siapa yang menulis teksnya. Boleh abaikan.

**Kelas:** guru bisa punya banyak kelas. Endpoint yang menerima `?classroomId=` memakai kelas pertama kalau tidak diisi.

**PIN gambar anak:** 9 gambar bernomor **1–9**: 1 bintang, 2 matahari, 3 kilau, 4 puzzle, 5 mobil, 6 bulan, 7 robot, 8 kincir, 9 kuda goyang. Kirim 3 nomor berurutan, **boleh berulang** (mis. `[1, 1, 1]` = bintang tiga kali): `"picturePassword": [2, 5, 8]`. Salah 5 kali, akun anak terkunci.

**Bintang dan poin per latihan** (dihitung server): akurasi < 50% = 0 bintang, 0 poin · 50–69% = 1 bintang (10 poin) · 70–89% = 2 bintang (20) · 90–100% = 3 bintang (30).

**Level terbuka** kalau level sebelumnya sudah ≥ 1 bintang (atau dibuka guru lewat batas level).

---

# Aplikasi Guru

## 1. Login
`POST /auth/teacher/login`
```json
{ "email": "guru@satu.id", "password": "..." }
```
Jawaban:
```json
{
  "token": "eyJ...",
  "role": "teacher",
  "teacher": { "id": "...", "name": "Bu Rina", "email": "guru@satu.id" },
  "classroom": { "id": "...", "name": "Kelas 1" },
  "classrooms": [{ "id": "...", "name": "Kelas 1", "createdAt": "...", "studentCount": 2 }]
}
```
Simpan `teacher.name` dan `teacher.email` untuk layar **Akun**. `classroom` = kelas pertama.

## 2. Kelas Saya / Tambah Kelas
- `GET /classrooms` → `[{ id, name, createdAt, studentCount }]`
- `POST /classrooms` `{ "name": "Kelas B" }` → 201, kelas baru. Nama kembar → 409.

## 3. Tambah anak (+ link orang tua)
`POST /students` → 201
```json
{
  "nickname": "Raka",
  "picturePassword": [2, 5, 8],
  "classroomId": "...",
  "parentName": "Ibu Sari",
  "parentWhatsapp": "081234567890",
  "photoUrl": "https://... atau data URL kecil",
  "birthDate": "2018-05-01"
}
```
Wajib: `nickname`, `picturePassword`. Lainnya opsional (`classroomId` kosong = kelas pertama, `parentName` kosong = "Orang tua {nickname}").

Jawaban (layar "Anak Ditambahkan"):
```json
{
  "id": "...", "nickname": "Raka", "photoUrl": "...", "isLocked": false,
  "parentWhatsapp": "6281234567890", "parentId": "...",
  "invite": {
    "inviteToken": "ptvj6sNa...",
    "inviteUrl": "satu://undangan/ptvj6sNa...",
    "expiresAt": "2026-11-21T06:50:12.458Z"
  }
}
```
Guru cukup **menyalin `invite.inviteUrl`**. Link sekali pakai dan berlaku 7 hari. Link baru: lihat bagian 8.

## 4. Daftar anak / profil terkunci
`GET /classroom/students?classroomId=` → `[{ id, nickname, photoUrl, isLocked }]`
Untuk layar **Profile Terkunci**, tampilkan yang `isLocked: true`. (Waktu "5 menit yang lalu" belum tersedia.)

## 5. Kendali manual anak
- **Ubah foto / nama anak:** `PATCH /students/:id` `{ "photoUrl": "data:image/jpeg;base64,..." }` dan/atau `{ "nickname": "..." }`.
  `photoUrl` boleh link `https://...` atau data URL base64 (maks ±700 KB; kecilkan dulu, mis. 300×300 JPEG kualitas 80).
  `{ "photoUrl": null }` = hapus foto. Kirim juga `photoUrl` saat membuat anak (`POST /students`) supaya fotonya langsung ada.
- **Reset PIN:** `PUT /students/:id/picture-password` `{ "picturePassword": [1,2,3] }` (sekaligus membuka kunci).
- **Buka profil terkunci:** `POST /students/:id/unlock` (tanpa body).
- **Batas level:** `PUT /students/:id/level` `{ "maxLevel": 3 }`. Nilai 1–6, atau `null` = ikuti aturan bintang. Level di atas batas terkunci di akun anak. Nilai saat ini ada di `student.maxLevel` pada detail anak (bagian 6).

## 6. Monitoring
**Ringkasan kelas:** `GET /dashboard/class?classroomId=`
```json
{
  "classroom": { "id": "...", "name": "Kelas 1" },
  "totals": { "students": 2, "practisedToday": 1, "practicesToday": 2, "averageStars": 3, "brokenStreaks": 2 },
  "students": [{ "id": "...", "nickname": "Raka", "photoUrl": "...", "isLocked": false,
                 "totalPoints": 20, "todayCount": 2, "streak": 0, "levelsDone": 1,
                 "avgStars": 3, "lastPracticeAt": "...", "openHomework": 0 }]
}
```

**Tabel kelas (anak × bunyi, centang):** `GET /dashboard/class/sounds?classroomId=`
```json
{
  "classroom": { "id": "...", "name": "Kelas 1" },
  "sounds": ["a","i","u","e","o","M","F","H","S","T"],
  "students": [{
    "id": "...", "nickname": "Raka", "photoUrl": "...",
    "status":  { "a": "sudah_bisa", "i": "sedang_dilatih", "u": "belum_dilatih", "...": "..." },
    "cleared": { "a": true, "i": false, "u": false, "...": false },
    "canDo": ["Bunyi a"],
    "source": "ai"
  }]
}
```
- Centang **penguasaan AI** = `cleared[bunyi] === true` (baru centang setelah konsisten benar, ≥ 85%).
- Untuk tanda **latihan selesai** (sama dengan peta web anak), pakai bintang: `levels[].items[].bestStars >= 1` di report anak di bawah.
- `status`: `sudah_bisa` | `hampir_bisa` | `sedang_dilatih` | `belum_dilatih`.
- Kode bunyi besar: `M` = m/b/p, `F` = f/v, `H` = h, `S` = desis (s, c, z, j), `T` = huruf lidah (t, d, n, l, r, k, g).
- `canDo` = teks siap tampil untuk "apa yang sudah bisa dilakukan anak".

**Report satu anak:** `GET /dashboard/students/:id`
```json
{
  "student": { "id": "...", "nickname": "Raka", "photoUrl": "...", "isLocked": false, "maxLevel": 3 },
  "totalPoints": 180,
  "status": { "...": "..." }, "cleared": { "...": false }, "canDo": ["Bunyi a"], "source": "ai",
  "practiceDays7": 5,
  "streak": { "current": 4, "longest": 4, "lastActiveDay": "...", "dailyTarget": 3, "todayCount": 2,
              "last7Days": [{ "day": "2026-11-08", "count": 0, "active": false }] },
  "levels": [ "...peta level + bintang per item..." ],
  "recentAttempts": [{ "id": "...", "levelTitle": "...", "item": "t1-a", "itemText": "a",
                       "success": true, "score": 92, "stars": 3, "source": "school", "createdAt": "..." }],
  "homework": [ "...daftar PR anak..." ]
}
```
Pemetaan layar Report: "5/7 hari latihan" = `practiceDays7`, poin = `totalPoints`, hari beruntun = `streak.current`.

**Tanda selesai per latihan** = `levels[].items[].bestStars` (0–3). Id latihan halaman peta: vokal `t1-a`, `t1-i`, `t1-u`, `t1-e`, `t1-o`; konsonan `t1-F`, `t1-H`, `t1-M`; suku kata `t3-fa`, `t3-ha`, `t3-ma`, `t3-wa`, `t3-ya`; kata `t4-mama`. Tiap item juga membawa `tutorialUrl` (video) atau `null`.

**Grafik perkembangan:** `GET /ai/students/:id/history`
```json
{ "daily": [{ "date": "2026-11-14", "attempts": 4, "successes": 3, "rate": 75 }], "perSound": {}, "source": "ai" }
```
`rate` 0–100 (persen berhasil per hari). Urut dari yang terlama.

## 7. AI untuk guru
- **Ringkasan kelas:** `GET /ai/class/insight?classroomId=` → `{ summary, issues: [{ item, problem }], writer, source }`
- **Ringkasan satu anak:** `GET /ai/students/:id/insight` → `{ summary, level, issues, sounds, focus, advice, adviceWriter, source }`
- **Tanya AI:** `POST /ai/students/:id/ask` `{ "question": "Bunyi apa yang paling sulit?" }` → `{ answer, references, writer, source }`. Bisa memakan sampai 20 detik; tampilkan loading.

## 8. Orang tua
- **Daftar:** `GET /parents?classroomId=` → `[{ id, name, email, status: "menunggu" | "aktif", activatedAt, children: [{ id, nickname }] }]`
- **Undang manual:** `POST /parents/invites` `{ "parentName": "Ibu Sari", "studentIds": ["..."] }` → 201, berisi `inviteToken`, `inviteUrl`, `expiresAt`, plus `whatsappText` / `whatsappUrl` (boleh diabaikan; cukup salin `inviteUrl`).
- **Link baru** (yang lama hangus, hanya untuk akun yang belum aktif): `POST /parents/:id/invites` → 201 dengan field yang sama. Akun sudah aktif → 409.

## 9. Tugas (PR) dari AI, guru menyetujui
1. **Usulan sekelas:** `GET /ai/class/suggested-homework?classroomId=`
   ```json
   [{ "student": { "id": "...", "nickname": "Raka", "photoUrl": null },
      "items": [{ "levelId": "level-1", "item": "t1-i", "text": "i", "reason": "Raka sedang melatih bunyi ini hari ini." }],
      "writer": "llm", "source": "ai" }]
   ```
   Usulan satu anak: `GET /ai/students/:id/suggested-homework` → `{ items, writer, source }`.
2. **Setuju Semua:** `POST /homework/batch` → 201
   ```json
   { "dueDate": "2026-11-20", "note": "opsional",
     "assignments": [{ "studentId": "...", "items": [{ "levelId": "level-1", "item": "t1-i" }] }] }
   ```
   Semua berhasil atau tidak sama sekali (ada item salah → 400, tidak ada PR yang dibuat). Item boleh diubah guru sebelum dikirim. Cukup kirim `item` (id latihan, mis. `t1-e`); `levelId` **opsional** dan dibetulkan backend kalau salah. Hanya latihan yang tidak ada di kurikulum yang ditolak (400).
3. **PR satu anak:** `POST /homework` `{ "studentId", "items", "dueDate"?, "note"? }` → 201 (maksimal 10 item).
4. **Hasil pengerjaan:** `GET /homework/submissions?classroomId=&studentId=&status=assigned|done` → daftar PR dengan `items[].attempts`, `items[].bestStars`, `items[].completedAt`.

## 10. Hadiah
- `GET /teacher/rewards` → katalog
- `POST /teacher/rewards` `{ "name", "costPoints", "stock"?: number|null, "imageUrl"? }` → 201
- `GET /teacher/redemptions?status=requested|given` → penukaran oleh anak
- `POST /teacher/redemptions/:id/give` → tandai sudah diserahkan

---

# Aplikasi Orang Tua

## 1. Aktivasi lewat link
Link dari guru berbentuk `satu://undangan/<TOKEN>`. Ambil `<TOKEN>` dari deep link.
1. `GET /invites/<TOKEN>` → `{ "parentName": "Ibu Sari", "children": ["Raka"] }` (untuk sapaan). Link tidak berlaku (dipakai / kedaluwarsa) → 404.
2. `POST /invites/<TOKEN>/accept` `{ "email": "...", "password": "minimal 8 karakter" }` → langsung login:
   ```json
   { "token": "eyJ...", "role": "parent", "parent": { "id": "...", "name": "Ibu Sari", "email": "..." } }
   ```
   Email sudah dipakai → 409.

## 2. Login berikutnya
`POST /auth/parent/login` `{ "email", "password" }` → bentuk jawaban sama seperti di atas.

## 3. Data anak
Semua pakai `:id` = id anak dari `GET /parent/children`. Anak yang bukan milik akun ini → 404.
- `GET /parent/children` → `[{ id, nickname, photoUrl, totalPoints, classroomName }]`
- `GET /parent/children/:id/homework?status=assigned|done` → PR (struktur sama dengan hasil PR guru).
  Tiap item PR punya **`tutorialUrl`**: link video MP4 bentuk mulut untuk latihan itu
  (mis. `https://tunarungu.neotelemetri.id/tutorial/t1-a.mp4`), atau `null` kalau belum ada videonya.
  Putar dengan ExoPlayer / `VideoView`, diulang (loop), tanpa suara. Video tidak butuh token.
- `GET /parent/children/:id/streak` → `{ current, longest, lastActiveDay, dailyTarget, todayCount, last7Days: [{ day, count, active }] }`
- `GET /parent/children/:id/progress` → peta level; tiap item punya `bestStars` (tanda selesai) dan `tutorialUrl`
- `GET /parent/children/:id/weekly-report` → `{ achieved, practising, howToHelp, practiceDays, references, writer, source }` (ditulis AI)
- `POST /parent/children/:id/ask` `{ "question": "..." }` → `{ answer, references, writer, source }`

## 4. Latihan di rumah
`POST /parent/children/:id/practice-token` → `{ token, role: "student", student: {...} }`
Token ini dipakai halaman latihan web anak (bukan aplikasi ini). Buka halaman latihan dengan token itu; anak tidak perlu PIN.

---

## Contoh cepat (curl)
```bash
# login guru
curl -s -X POST https://tunarungu.neotelemetri.id/api/auth/teacher/login \
  -H 'content-type: application/json' -d '{"email":"guru@satu.id","password":"..."}'

# tabel kelas
curl -s https://tunarungu.neotelemetri.id/api/dashboard/class/sounds \
  -H 'Authorization: Bearer <token>'
```

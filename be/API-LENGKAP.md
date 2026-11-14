# SATU API — dokumentasi lengkap

Base URL: `https://tunarungu.neotelemetri.id/api` · Swagger interaktif: `https://tunarungu.neotelemetri.id/docs`

Isi file ini sama dengan Swagger: dibuat otomatis dari kode backend dan contoh respons asli (`npm run docs:md`).
Contoh respons memakai data contoh (nama Raka, Sinta, Bu Rina); id di contoh **bukan** id asli di server.

## Daftar isi
- [Aplikasi Guru (mobile)](#aplikasi-guru-mobile)
- [Aplikasi Orang Tua (mobile)](#aplikasi-orang-tua-mobile)
- [Web Anak (laptop sekolah)](#web-anak-laptop-sekolah)

API untuk **SATU (Sahabat Tunarungu)**. Satu backend dipakai oleh 3 aplikasi; endpoint dikelompokkan per aplikasi di bawah.

### Cara pakai halaman ini
1. Buka endpoint **login** di kotak aplikasimu, klik **Try it out**, isi body, lalu **Execute**.
2. Salin nilai `token` dari respons.
3. Klik tombol **Authorize** (gembok, kanan atas), tempel token (tanpa kata "Bearer"), **Authorize**.
4. Sekarang endpoint lain bisa dicoba. Token tersimpan walau halaman di-refresh.

### Aturan umum
| | |
|---|---|
| Alamat | `{BASE_URL}/api/...`, BASE_URL dari pemilik backend |
| Header login | `Authorization: Bearer <token>` |
| Format | JSON, nama field **camelCase**, tanggal `YYYY-MM-DD` (WIB), waktu ISO 8601 |
| Masa berlaku token | guru 7 hari · orang tua 30 hari · anak 3 jam · perangkat kelas 90 hari |
| Data "live" | polling tiap 5 detik (tidak ada WebSocket) |

### Format error (semua endpoint)
```json
{ "detail": "Data tidak valid", "errors": [{ "path": "picturePassword", "message": "Pilih tepat 3 gambar" }] }
```
| Status | Arti |
|---|---|
| 400 | Data tidak valid (lihat `errors`) |
| 401 | Belum login / token salah / password salah |
| 403 | Peran salah (mis. token anak ke endpoint guru) atau akun anak terkunci |
| 404 | Tidak ada, **atau bukan milikmu** (anak kelas lain, anak orang lain) |
| 409 | Bentrok: email sudah dipakai, nama kelas kembar, stok habis |
| 429 | Terlalu banyak login gagal, tunggu 15 menit |

### Mengirim hasil latihan (Mata → backend)
`POST /attempts` menerima keluaran komponen Mata apa adanya + `itemId`:
`{ "itemId": "t1-a", "berhasil": true, "langkah_tercapai": 1, "durasi_ms": 1800, "kemiripan": 0.92 }`.
Bintang dihitung **server**; `bintang`/`poin` kiriman klien diabaikan. **Benar** = `berhasil` dan kemiripan ≥ 0,5.
Di bawah 0,5 → 0 bintang dan 0 poin (anak mengulang, tanpa pop up) · 0,5–0,69 → 1 bintang · 0,7–0,89 → 2 bintang · ≥ 0,9 → 3 bintang. Poin = bintang × 10 (10 / 20 / 30) tiap percobaan.
Jawaban memuat `correct`, `accuracy` (persen), dan `next` (item berikutnya dari AI).
Field `source` di jawaban AI: `"ai"` = dijawab layanan AI, `"fallback"` = aturan cadangan (layanan AI mati/lambat).

### PIN gambar anak
9 gambar bernomor **tetap 1–9** (nomor melekat ke gambar, bukan posisi di layar): 1 bintang, 2 matahari, 3 kilau,
4 puzzle, 5 mobil, 6 bulan, 7 robot, 8 kincir, 9 kuda goyang. Anak/guru mengetuk 3 kali, urutan menentukan →
kirim `"picturePassword": [2, 5, 8]`. **Gambar yang sama boleh dipilih lagi**, mis. `[1, 1, 1]` = bintang tiga kali.
Salah 5× → akun anak terkunci; web anak menampilkan "Minta Bantuan Guru"
dan terbuka sendiri begitu guru membuka kunci / ganti PIN.

### Level dan bintang
- **Level terbuka** kalau level sebelumnya sudah ≥ 1 bintang (aturan hackathon; pembukaan dari penguasaan AI dimatikan).
  Level dengan bintang terbaik 3 = `"tuntas"`. Field `source` di peta = `"stars"`.
- **Batas level guru:** `PUT /students/{id}/level` `{ "maxLevel": 1–6 | null }`. Level sampai batas terbuka, di atasnya
  terkunci (`lockedByTeacher: true`). `null` = kembali ke aturan bintang.
- **Tanda selesai** di aplikasi = `bestStars` per item (0–3) di `levels[].items[]`. Jangan pakai `cleared`/`canDo`
  untuk itu: keduanya penguasaan menurut AI (baru centang setelah konsisten benar, ≥ 85%), untuk laporan perkembangan.
- **Usulan PR** (`suggested-homework`) tidak pernah berisi latihan yang sudah 3 bintang atau yang levelnya terkunci untuk
  anak itu; kekurangannya diisi latihan peta yang belum selesai.
- **PR selesai otomatis:** latihan benar (≥ 1 bintang) pada item PR yang masih terbuka dihitung untuk PR itu, walau
  dikerjakan dari peta tanpa `homeworkItemId`.

### Video tutorial
Tiap latihan yang punya video membawa `tutorialUrl` (MP4, H.264, tanpa token), mis.
`https://tunarungu.neotelemetri.id/tutorial/t1-a.mp4`; `null` kalau belum ada. Ada di item peta (`GET /levels`,
`GET /parent/children/{id}/progress`) dan di item PR (`GET /parent/children/{id}/homework`, `/homework/submissions`).
Putar diulang tanpa suara.

### Token perangkat kelas (web anak)
Laptop kelas tidak login guru. Pemilik server membuat token khusus: `npm run device-token -- --email <guru>`.
Token ini hanya boleh `GET /classroom/students` (kelasnya sendiri) dan `POST /auth/student/login`; endpoint lain → 403.

---

## Aplikasi Guru (mobile)

**Dipakai teman mobile (aplikasi guru).** Alur: login (dapat daftar `classrooms`) → pilih/tambah kelas (`GET/POST /classrooms`) → buat akun anak (`POST /students`, PIN 3 gambar, boleh berulang; jawaban memuat `invite.inviteUrl` = link orang tua, cukup disalin) → kendali anak (reset PIN, buka kunci, batas level `PUT /students/{id}/level`) → pantau kelas, tabel bunyi (`GET /dashboard/class/sounds`) & report anak → usulan PR AI sekelas → Setuju Semua (`POST /homework/batch`) → hasil PR → hadiah. Endpoint kelas menerima `?classroomId=` (kosong = kelas pertama).

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/auth/teacher/login` | Login guru (aplikasi guru / mode kelas di laptop) |
| GET | `/api/classrooms` | Kelas saya (layar Kelas Saya) |
| POST | `/api/classrooms` | Tambah kelas |
| POST | `/api/students` | Guru membuat akun anak (+PIN 3 gambar). Jawaban memuat `invite` = link orang tua siap disalin |
| PATCH | `/api/students/{id}` | Ubah data anak: foto (`photoUrl`: link atau data URL base64, maks ±700 KB; null = hapus) dan/atau nama panggilan |
| PUT | `/api/students/{id}/picture-password` | Ganti PIN gambar anak (lupa PIN); sekaligus membuka kunci |
| PUT | `/api/students/{id}/level` | Guru menetapkan level tertinggi yang boleh dibuka anak (1-6); null = kembali ke aturan bintang. Level di atasnya terkunci di akun anak |
| POST | `/api/students/{id}/unlock` | Buka kunci akun anak |
| POST | `/api/parents/invites` | Undang orang tua: nama + anak (dropdown). Mengembalikan link undangan + teks/link WhatsApp |
| GET | `/api/parents` | Daftar orang tua + status (menunggu/aktif) |
| POST | `/api/parents/{id}/invites` | Buat ulang link undangan (link lama hangus) |
| GET | `/api/dashboard/class` | Monitoring sekelas: total + ringkasan per anak |
| GET | `/api/dashboard/class/sounds` | Tabel kelas: tiap anak x bunyi a,i,u,e,o,... (status + centang `cleared`) dan `canDo` |
| GET | `/api/dashboard/students/{id}` | Progres satu anak: level, riwayat, streak, PR |
| GET | `/api/dashboard/students/{id}/chart` | Grafik belajar per hari, siap digambar: labels + series (latihan, benar, akurasi, poin); hari kosong = 0 |
| GET | `/api/ai/class/insight` | Ringkasan AI untuk sekelas |
| GET | `/api/ai/class/suggested-homework` | Usulan PR AI untuk semua anak di kelas (guru setujui lewat POST /homework/batch) |
| GET | `/api/ai/students/{id}/insight` | Ringkasan AI satu anak: level + kendala |
| GET | `/api/ai/students/{id}/suggested-homework` | Usulan PR dari AI (guru boleh ubah sebelum kirim) |
| GET | `/api/ai/students/{id}/history` | Riwayat latihan harian dan kemajuan per bunyi (untuk grafik) |
| POST | `/api/ai/students/{id}/ask` | Tanya AI tentang progres satu anak (jawaban dari data latihan) |
| POST | `/api/homework` | Kirim PR ke anak (dikerjakan bersama orang tua) |
| POST | `/api/homework/batch` | Setuju Semua: kirim PR ke banyak anak sekaligus (semua berhasil atau tidak sama sekali) |
| GET | `/api/homework/submissions` | PR di kelas beserta hasil pengerjaannya |
| GET | `/api/teacher/rewards` | Katalog hadiah guru |
| POST | `/api/teacher/rewards` | Tambah hadiah |
| GET | `/api/teacher/redemptions` | Penukaran hadiah di kelas |
| POST | `/api/teacher/redemptions/{id}/give` | Tandai hadiah sudah diserahkan |

### POST `/api/auth/teacher/login`

**Login guru (aplikasi guru / mode kelas di laptop)**

- Login: Tanpa login.

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `email` | string (email) | ya | email valid |
| `password` | string | ya | panjang min 1, panjang maks 72 |

Contoh body:
```json
{
  "email": "guru@satu.id",
  "password": "gurusatu!"
}
```

**Respons 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "role": "teacher",
  "teacher": {
    "id": "11c50368-e20c-4b5d-a9d3-ce972667a4b6",
    "name": "Bu Rina",
    "email": "guru@satu.id"
  },
  "classroom": {
    "id": "a21e5dc3-515b-4f56-9750-d379c00064e8",
    "name": "Kelas 1"
  },
  "classrooms": [
    {
      "id": "a21e5dc3-515b-4f56-9750-d379c00064e8",
      "name": "Kelas 1",
      "createdAt": "2026-11-14T14:31:10.910Z",
      "studentCount": 0
    }
  ]
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/auth/teacher/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"guru@satu.id","password":"gurusatu!"}'
```

</details>

### GET `/api/classrooms`

**Kelas saya (layar Kelas Saya)**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)

**Respons 200:**
```json
[
  {
    "id": "a21e5dc3-515b-4f56-9750-d379c00064e8",
    "name": "Kelas 1",
    "createdAt": "2026-11-14T14:31:10.910Z",
    "studentCount": 2
  }
]
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/classrooms" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### POST `/api/classrooms`

**Tambah kelas**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `name` | string | ya | panjang min 1, panjang maks 50 |

Contoh body:
```json
{
  "name": "Kelas B"
}
```

**Respons 201:**
```json
{
  "id": "0e4859fe-b408-40c1-baaa-944e2d0655f7",
  "name": "Kelas B",
  "createdAt": "2026-11-14T14:31:11.134Z",
  "studentCount": 0
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/classrooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Kelas B"}'
```

</details>

### POST `/api/students`

**Guru membuat akun anak (+PIN 3 gambar). Jawaban memuat `invite` = link orang tua siap disalin**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `nickname` | string | ya | panjang min 1, panjang maks 50 |
| `parentWhatsapp` | string | tidak |  |
| `birthDate` | string (date) | tidak | format YYYY-MM-DD |
| `photoUrl` | string | tidak | panjang maks 700000 |
| `picturePassword` | array of integer | ya | min 3 isi, maks 3 isi, tiap isi 1–9 |
| `classroomId` | string (uuid) | tidak | UUID |
| `parentName` | string | tidak | panjang min 1, panjang maks 100 |

Contoh body:
```json
{
  "nickname": "Raka",
  "parentWhatsapp": "081234567890",
  "photoUrl": "https://contoh.id/foto/raka.jpg",
  "picturePassword": [2, 5, 8]
}
```

**Respons 201:**
```json
{
  "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
  "nickname": "Raka",
  "photoUrl": "https://contoh.id/foto/raka.jpg",
  "isLocked": false,
  "parentWhatsapp": "6281234567890",
  "parentId": "c85fab10-c724-46e7-b2bb-2bc97a7c317b",
  "invite": {
    "inviteToken": "OfasjShysVAaSfoDwL8yNAqgPhFtE7qp",
    "inviteUrl": "satu://undangan/OfasjShysVAaSfoDwL8yNAqgPhFtE7qp",
    "expiresAt": "2026-11-21T14:31:11.065Z"
  }
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/students" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"Raka","parentWhatsapp":"081234567890","photoUrl":"https://contoh.id/foto/raka.jpg","picturePassword":[2,5,8]}'
```

</details>

### PATCH `/api/students/{id}`

**Ubah data anak: foto (`photoUrl`: link atau data URL base64, maks ±700 KB; null = hapus) dan/atau nama panggilan**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `nickname` | string | tidak | panjang min 1, panjang maks 50 |
| `photoUrl` | string atau null | tidak |  |

Contoh body:
```json
{
  "photoUrl": "https://contoh.id/foto/raka-baru.jpg"
}
```

**Respons 200:**
```json
{
  "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
  "nickname": "Raka",
  "photoUrl": "https://contoh.id/foto/raka-baru.jpg",
  "isLocked": false
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X PATCH "https://tunarungu.neotelemetri.id/api/students/{id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"photoUrl":"https://contoh.id/foto/raka-baru.jpg"}'
```

</details>

### PUT `/api/students/{id}/picture-password`

**Ganti PIN gambar anak (lupa PIN); sekaligus membuka kunci**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `picturePassword` | array of integer | ya | min 3 isi, maks 3 isi, tiap isi 1–9 |

Contoh body:
```json
{
  "picturePassword": [2, 5, 8]
}
```

**Respons 200:**
```json
{
  "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
  "nickname": "Raka",
  "photoUrl": "https://contoh.id/foto/raka-baru.jpg",
  "isLocked": false
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X PUT "https://tunarungu.neotelemetri.id/api/students/{id}/picture-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"picturePassword":[2,5,8]}'
```

</details>

### PUT `/api/students/{id}/level`

**Guru menetapkan level tertinggi yang boleh dibuka anak (1-6); null = kembali ke aturan bintang. Level di atasnya terkunci di akun anak**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `maxLevel` | integer atau null | ya |  |

Contoh body:
```json
{
  "maxLevel": 3
}
```

**Respons 200:**
```json
{
  "studentId": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
  "maxLevel": 3
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X PUT "https://tunarungu.neotelemetri.id/api/students/{id}/level" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxLevel":3}'
```

</details>

### POST `/api/students/{id}/unlock`

**Buka kunci akun anak**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Respons 200:**
```json
{
  "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
  "nickname": "Raka",
  "photoUrl": "https://contoh.id/foto/raka-baru.jpg",
  "isLocked": false
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/students/{id}/unlock" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### POST `/api/parents/invites`

**Undang orang tua: nama + anak (dropdown). Mengembalikan link undangan + teks/link WhatsApp**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `parentName` | string | ya | panjang min 1, panjang maks 100 |
| `studentIds` | array of string (uuid) | ya | min 1 isi |

Contoh body:
```json
{
  "parentName": "Ibu Sari",
  "studentIds": [
    "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a"
  ]
}
```

**Respons 201:**
```json
{
  "parent": {
    "id": "fb457e30-a7c2-47f0-916d-7e737132b3a3",
    "name": "Ibu Sari",
    "status": "menunggu",
    "children": [
      {
        "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
        "nickname": "Raka"
      }
    ]
  },
  "expiresAt": "2026-11-21T14:31:11.566Z",
  "inviteToken": "KDyDXkCuh4wlI9W7HuE9S-zmP_N6MOEv",
  "inviteUrl": "satu://undangan/KDyDXkCuh4wlI9W7HuE9S-zmP_N6MOEv",
  "whatsappText": "Halo Ibu Sari, silakan aktifkan akun SATU untuk mendampingi Raka berlatih bicara di rumah: satu://undangan/KDyDXkCuh4wlI9W7HuE9S-zmP_N6MOEv",
  "whatsappUrl": "https://wa.me/6281234567890?text=Halo%20Ibu%20Sari%2C%20silakan%20aktifkan%20akun%20SATU%20untuk%20mendampingi%20Raka%20berlatih%20bicara%20di%20rumah%3A%20satu%3A%2F%2Fundangan%2FKDyDXkCuh4wlI9W7HuE9S-zmP_N6MOEv"
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/parents/invites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"parentName":"Ibu Sari","studentIds":["cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a"]}'
```

</details>

### GET `/api/parents`

**Daftar orang tua + status (menunggu/aktif)**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter query (opsional): `classroomId` (string (uuid))

**Respons 200:**
```json
[
  {
    "id": "be6e4d95-215e-4731-9c70-2ba06b409b04",
    "name": "Ayah Sinta",
    "email": null,
    "status": "menunggu",
    "activatedAt": null,
    "children": [
      {
        "id": "cb14a94b-ccb0-413b-8687-3777ec902ce8",
        "nickname": "Sinta"
      }
    ]
  },
  {
    "id": "fb457e30-a7c2-47f0-916d-7e737132b3a3",
    "name": "Ibu Sari",
    "email": "ibu.sari@gmail.com",
    "status": "aktif",
    "activatedAt": "2026-11-14T14:31:11.633Z",
    "children": [
      {
        "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
        "nickname": "Raka"
      }
    ]
  },
  {
    "id": "c85fab10-c724-46e7-b2bb-2bc97a7c317b",
    "name": "Orang tua Raka",
    "email": null,
    "status": "menunggu",
    "activatedAt": null,
    "children": [
      {
        "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
        "nickname": "Raka"
      }
    ]
  },
  {
    "id": "17451629-61ef-4f3e-a90d-c31bbec8b197",
    "name": "Orang tua Sinta",
    "email": null,
    "status": "menunggu",
    "activatedAt": null,
    "children": [
      {
        "id": "cb14a94b-ccb0-413b-8687-3777ec902ce8",
        "nickname": "Sinta"
      }
    ]
  }
]
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/parents" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### POST `/api/parents/{id}/invites`

**Buat ulang link undangan (link lama hangus)**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id orang tua (UUID), dari GET /parents

**Respons 201:**
```json
{
  "expiresAt": "2026-11-21T14:31:11.605Z",
  "inviteToken": "d_nMRTfrzD-ho-uveH5lcf9jK3I4ZRKZ",
  "inviteUrl": "satu://undangan/d_nMRTfrzD-ho-uveH5lcf9jK3I4ZRKZ",
  "whatsappText": "Halo Ayah Sinta, silakan aktifkan akun SATU untuk mendampingi Sinta berlatih bicara di rumah: satu://undangan/d_nMRTfrzD-ho-uveH5lcf9jK3I4ZRKZ",
  "whatsappUrl": "https://wa.me/?text=Halo%20Ayah%20Sinta%2C%20silakan%20aktifkan%20akun%20SATU%20untuk%20mendampingi%20Sinta%20berlatih%20bicara%20di%20rumah%3A%20satu%3A%2F%2Fundangan%2Fd_nMRTfrzD-ho-uveH5lcf9jK3I4ZRKZ"
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/parents/{id}/invites" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/dashboard/class`

**Monitoring sekelas: total + ringkasan per anak**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter query (opsional): `classroomId` (string (uuid))

**Respons 200:**
```json
{
  "classroom": {
    "id": "a21e5dc3-515b-4f56-9750-d379c00064e8",
    "name": "Kelas 1"
  },
  "totals": {
    "students": 2,
    "practisedToday": 1,
    "practicesToday": 2,
    "averageStars": 3,
    "brokenStreaks": 2
  },
  "students": [
    {
      "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
      "nickname": "Raka",
      "photoUrl": "https://contoh.id/foto/raka-baru.jpg",
      "isLocked": false,
      "totalPoints": 10,
      "todayCount": 2,
      "streak": 0,
      "levelsDone": 1,
      "avgStars": 3,
      "lastPracticeAt": "2026-11-14T14:31:11.493Z",
      "openHomework": 0
    },
    {
      "id": "cb14a94b-ccb0-413b-8687-3777ec902ce8",
      "nickname": "Sinta",
      "photoUrl": null,
      "isLocked": false,
      "totalPoints": 0,
      "todayCount": 0,
      "streak": 0,
      "levelsDone": 0,
      "avgStars": 0,
      "lastPracticeAt": null,
      "openHomework": 0
    }
  ]
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/dashboard/class" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/dashboard/class/sounds`

**Tabel kelas: tiap anak x bunyi a,i,u,e,o,... (status + centang `cleared`) dan `canDo`**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter query (opsional): `classroomId` (string (uuid))

**Respons 200:**
```json
{
  "classroom": {
    "id": "a21e5dc3-515b-4f56-9750-d379c00064e8",
    "name": "Kelas 1"
  },
  "sounds": ["a", "i", "u", "e", "o", "M", "F", "H", "S", "T"],
  "students": [
    {
      "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
      "nickname": "Raka",
      "photoUrl": "https://contoh.id/foto/raka-baru.jpg",
      "status": {
        "a": "sudah_bisa",
        "i": "sedang_dilatih",
        "u": "belum_dilatih",
        "e": "belum_dilatih",
        "o": "belum_dilatih",
        "M": "belum_dilatih",
        "F": "belum_dilatih",
        "H": "belum_dilatih",
        "S": "belum_dilatih",
        "T": "belum_dilatih"
      },
      "cleared": {
        "a": true,
        "i": false,
        "u": false,
        "e": false,
        "o": false,
        "M": false,
        "F": false,
        "H": false,
        "S": false,
        "T": false
      },
      "canDo": ["Bunyi a"],
      "source": "ai"
    },
    {
      "id": "cb14a94b-ccb0-413b-8687-3777ec902ce8",
      "nickname": "Sinta",
      "photoUrl": null,
      "status": {
        "a": "belum_dilatih",
        "i": "belum_dilatih",
        "u": "belum_dilatih",
        "e": "belum_dilatih",
        "o": "belum_dilatih",
        "M": "belum_dilatih",
        "F": "belum_dilatih",
        "H": "belum_dilatih",
        "S": "belum_dilatih",
        "T": "belum_dilatih"
      },
      "cleared": {
        "a": false,
        "i": false,
        "u": false,
        "e": false,
        "o": false,
  … (dipotong, lihat /docs untuk lengkapnya)
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/dashboard/class/sounds" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/dashboard/students/{id}`

**Progres satu anak: level, riwayat, streak, PR**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Respons 200:**
```json
{
  "student": {
    "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
    "nickname": "Raka",
    "photoUrl": "https://contoh.id/foto/raka-baru.jpg",
    "isLocked": false,
    "maxLevel": 3
  },
  "totalPoints": 10,
  "status": {
    "a": "sudah_bisa",
    "i": "sedang_dilatih",
    "u": "belum_dilatih",
    "e": "belum_dilatih",
    "o": "belum_dilatih",
    "M": "belum_dilatih",
    "F": "belum_dilatih",
    "H": "belum_dilatih",
    "S": "belum_dilatih",
    "T": "belum_dilatih"
  },
  "cleared": {
    "a": true,
    "i": false,
    "u": false,
    "e": false,
    "o": false,
    "M": false,
    "F": false,
    "H": false,
    "S": false,
    "T": false
  },
  "canDo": ["Bunyi a"],
  "source": "ai",
  "practiceDays7": 1,
  "streak": {
    "current": 0,
    "longest": 0,
    "lastActiveDay": null,
    "dailyTarget": 3,
    "todayCount": 2,
    "last7Days": [
      {
        "day": "2026-11-08",
        "count": 0,
        "active": false
      },
      {
        "day": "2026-11-09",
        "count": 0,
        "active": false
      },
      {
        "day": "2026-11-10",
        "count": 0,
        "active": false
      },
      {
        "day": "2026-11-11",
  … (dipotong, lihat /docs untuk lengkapnya)
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/dashboard/students/{id}" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/dashboard/students/{id}/chart`

**Grafik belajar per hari, siap digambar: labels + series (latihan, benar, akurasi, poin); hari kosong = 0**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children
- Parameter query (opsional): `days` (integer)

**Respons 200:**
```json
{
  "days": 7,
  "labels": ["Min 8/11", "Sen 9/11", "Sel 10/11", "Rab 11/11", "Kam 12/11", "Jum 13/11", "Sab 14/11"],
  "series": {
    "attempts": [0, 0, 0, 0, 0, 0, 3],
    "correct": [0, 0, 0, 0, 0, 0, 2],
    "accuracy": [0, 0, 0, 0, 0, 0, 64],
    "points": [0, 0, 0, 0, 0, 0, 40]
  },
  "daily": [
    {
      "date": "2026-11-08",
      "attempts": 0,
      "correct": 0,
      "stars": 0,
      "accuracy": 0,
      "school": 0,
      "home": 0,
      "points": 0,
      "label": "Min 8/11"
    },
    {
      "date": "2026-11-09",
      "attempts": 0,
      "correct": 0,
      "stars": 0,
      "accuracy": 0,
      "school": 0,
      "home": 0,
      "points": 0,
      "label": "Sen 9/11"
    },
    {
      "date": "2026-11-10",
      "attempts": 0,
      "correct": 0,
      "stars": 0,
      "accuracy": 0,
      "school": 0,
      "home": 0,
      "points": 0,
      "label": "Sel 10/11"
    },
    {
      "date": "2026-11-11",
      "attempts": 0,
      "correct": 0,
      "stars": 0,
      "accuracy": 0,
      "school": 0,
      "home": 0,
      "points": 0,
      "label": "Rab 11/11"
    },
    {
      "date": "2026-11-12",
      "attempts": 0,
      "correct": 0,
      "stars": 0,
      "accuracy": 0,
  … (dipotong, lihat /docs untuk lengkapnya)
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/dashboard/students/{id}/chart" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/ai/class/insight`

**Ringkasan AI untuk sekelas**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter query (opsional): `classroomId` (string (uuid))

**Respons 200:**
```json
{
  "summary": "Belum ada anak yang macet di satu bunyi. Yang membaik minggu ini: Raka (bunyi a).",
  "issues": [
    {
      "item": "Raka",
      "problem": "Belum berlatih rutin (streak putus)"
    },
    {
      "item": "Sinta",
      "problem": "Belum berlatih rutin (streak putus)"
    }
  ],
  "writer": "templat",
  "source": "ai"
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/ai/class/insight" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/ai/class/suggested-homework`

**Usulan PR AI untuk semua anak di kelas (guru setujui lewat POST /homework/batch)**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter query (opsional): `classroomId` (string (uuid))

**Respons 200:**
```json
[
  {
    "student": {
      "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
      "nickname": "Raka",
      "photoUrl": "https://contoh.id/foto/raka-baru.jpg"
    },
    "items": [
      {
        "levelId": "level-1",
        "item": "t1-i",
        "text": "i",
        "reason": "Raka sedang melatih bunyi ini hari ini."
      },
      {
        "levelId": "level-1",
        "item": "t1-u",
        "text": "u",
        "reason": "Raka belum pernah melatih bunyi ini."
      },
      {
        "levelId": "level-2",
        "item": "t1-e",
        "text": "e",
        "reason": "Belum pernah dicoba"
      }
    ],
    "writer": "llm",
    "source": "ai"
  },
  {
    "student": {
      "id": "cb14a94b-ccb0-413b-8687-3777ec902ce8",
      "nickname": "Sinta",
      "photoUrl": null
    },
    "items": [
      {
        "levelId": "level-1",
        "item": "t1-i",
        "text": "i",
        "reason": "Raka sedang melatih bunyi ini hari ini."
      },
      {
        "levelId": "level-1",
        "item": "t1-a",
        "text": "a",
        "reason": "Raka sudah bisa bunyi ini hari ini."
      },
      {
        "levelId": "level-1",
        "item": "t1-u",
        "text": "u",
        "reason": "Raka belum pernah melatih bunyi ini."
      }
    ],
    "writer": "llm",
    "source": "ai"
  }
]
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/ai/class/suggested-homework" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/ai/students/{id}/insight`

**Ringkasan AI satu anak: level + kendala**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Respons 200:**
```json
{
  "summary": "Raka sedang di level 1 (Vokal a, i, u). Belum ada bunyi yang macet. Baru naik minggu ini: a.",
  "level": "Vokal a, i, u",
  "issues": [],
  "sounds": [
    {
      "bunyi": "a",
      "label": "sudah_bisa",
      "tingkat": 1,
      "p": 0.901,
      "tingkat_tuntas": 1,
      "rinci": [
        {
          "tingkat": 1,
          "p": 0.901,
          "percobaan": 3,
          "label": "sudah_bisa"
        },
        {
          "tingkat": 2,
          "p": 0.2,
          "percobaan": 0,
          "label": "belum_dilatih"
        },
        {
          "tingkat": 3,
          "p": 0.15,
          "percobaan": 0,
          "label": "belum_dilatih"
        },
        {
          "tingkat": 4,
          "p": 0.1,
          "percobaan": 0,
          "label": "belum_dilatih"
        }
      ],
      "teks_label": "Sudah bisa",
      "warna": "hijau"
    },
    {
      "bunyi": "i",
      "label": "sedang_dilatih",
      "tingkat": 1,
      "p": 0.109,
      "tingkat_tuntas": 0,
      "rinci": [
        {
          "tingkat": 1,
          "p": 0.109,
          "percobaan": 1,
          "label": "sedang_dilatih"
        },
        {
          "tingkat": 2,
          "p": 0.2,
          "percobaan": 0,
          "label": "belum_dilatih"
        },
        {
  … (dipotong, lihat /docs untuk lengkapnya)
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/ai/students/{id}/insight" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/ai/students/{id}/suggested-homework`

**Usulan PR dari AI (guru boleh ubah sebelum kirim)**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Respons 200:**
```json
{
  "items": [
    {
      "levelId": "level-1",
      "item": "t1-i",
      "text": "i",
      "reason": "Raka sedang melatih bunyi ini hari ini."
    },
    {
      "levelId": "level-1",
      "item": "t1-u",
      "text": "u",
      "reason": "Raka belum pernah melatih bunyi ini."
    },
    {
      "levelId": "level-2",
      "item": "t1-e",
      "text": "e",
      "reason": "Belum pernah dicoba"
    }
  ],
  "writer": "llm",
  "source": "ai"
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/ai/students/{id}/suggested-homework" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/ai/students/{id}/history`

**Riwayat latihan harian dan kemajuan per bunyi (untuk grafik)**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Respons 200:**
```json
{
  "daily": [
    {
      "date": "2026-11-14",
      "attempts": 4,
      "successes": 3,
      "rate": 75
    }
  ],
  "perSound": {
    "a": [
      {
        "tanggal": "2026-11-14",
        "tingkat": 1,
        "p": 0.9008,
        "kemajuan": 0.225
      }
    ],
    "i": [
      {
        "tanggal": "2026-11-14",
        "tingkat": 1,
        "p": 0.1088,
        "kemajuan": 0.027
      }
    ]
  },
  "source": "ai"
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/ai/students/{id}/history" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### POST `/api/ai/students/{id}/ask`

**Tanya AI tentang progres satu anak (jawaban dari data latihan)**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `question` | string | ya | panjang min 3, panjang maks 300 |

Contoh body:
```json
{
  "question": "Bunyi apa yang paling sulit untuk Raka?"
}
```

**Respons 200:**
```json
{
  "answer": "Halo! Berdasarkan data latihan, bunyi yang paling perlu perhatian bagi Raka adalah bunyi i karena masih lemah dan sedang dilatih pada tahap bunyi tunggal dengan bantuan gambar.",
  "references": [],
  "writer": "llm",
  "source": "ai"
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/ai/students/{id}/ask" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"Bunyi apa yang paling sulit untuk Raka?"}'
```

</details>

### POST `/api/homework`

**Kirim PR ke anak (dikerjakan bersama orang tua)**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `studentId` | string (uuid) | ya | UUID |
| `dueDate` | string (date) | tidak | format YYYY-MM-DD |
| `note` | string | tidak | panjang maks 500 |
| `items` | array of object | ya | min 1 isi, maks 10 isi |
| `items[].levelId` | string | tidak | panjang min 1 |
| `items[].item` | string | ya | panjang min 1, panjang maks 50 |
| `items[].requiredStars` | integer | tidak | min 1, maks 3 |

Contoh body:
```json
{
  "studentId": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
  "dueDate": "2026-11-14",
  "note": "Latihan 10 menit sebelum tidur",
  "items": [
    {
      "levelId": "level-1",
      "item": "t1-i"
    },
    {
      "levelId": "level-1",
      "item": "t1-u"
    }
  ]
}
```

**Respons 201:**
```json
{
  "id": "bb3c3ef5-d663-48e9-a492-4445864d514b",
  "studentId": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
  "nickname": "Raka",
  "dueDate": "2026-11-14",
  "note": "Latihan 10 menit sebelum tidur",
  "status": "assigned",
  "createdAt": "2026-11-14T14:31:11.960Z",
  "completedAt": null,
  "items": [
    {
      "id": "c510a9c9-1761-48ed-9c22-b2046c5a01d6",
      "homeworkId": "bb3c3ef5-d663-48e9-a492-4445864d514b",
      "position": 1,
      "levelId": "level-1",
      "levelTitle": "Vokal a, i, u",
      "item": "t1-i",
      "itemText": "i",
      "requiredStars": 1,
      "completedAt": null,
      "attempts": 0,
      "bestStars": 0,
      "tutorialUrl": "/tutorial/t1-i.mp4"
    },
    {
      "id": "f2db142b-2b31-4298-a8f8-2f8317cbef7b",
      "homeworkId": "bb3c3ef5-d663-48e9-a492-4445864d514b",
      "position": 2,
      "levelId": "level-1",
      "levelTitle": "Vokal a, i, u",
      "item": "t1-u",
      "itemText": "u",
      "requiredStars": 1,
      "completedAt": null,
      "attempts": 0,
      "bestStars": 0,
      "tutorialUrl": "/tutorial/t1-u.mp4"
    }
  ]
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/homework" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a","dueDate":"2026-11-14","note":"Latihan 10 menit sebelum tidur","items":[{"levelId":"level-1","item":"t1-i"},{"levelId":"level-1","item":"t1-u"}]}'
```

</details>

### POST `/api/homework/batch`

**Setuju Semua: kirim PR ke banyak anak sekaligus (semua berhasil atau tidak sama sekali)**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `dueDate` | string (date) | tidak | format YYYY-MM-DD |
| `note` | string | tidak | panjang maks 500 |
| `assignments` | array of object | ya | min 1 isi, maks 100 isi |
| `assignments[].studentId` | string (uuid) | ya | UUID |
| `assignments[].items` | array of object | ya | min 1 isi, maks 10 isi |
| `assignments[].items[].levelId` | string | tidak | panjang min 1 |
| `assignments[].items[].item` | string | ya | panjang min 1, panjang maks 50 |
| `assignments[].items[].requiredStars` | integer | tidak | min 1, maks 3 |

Contoh body:
```json
{
  "assignments": [
    {
      "studentId": "cb14a94b-ccb0-413b-8687-3777ec902ce8",
      "items": [
        {
          "levelId": "level-1",
          "item": "t1-i"
        },
        {
          "levelId": "level-1",
          "item": "t1-u"
        }
      ]
    }
  ],
  "note": "Usulan AI disetujui"
}
```

**Respons 201:**
```json
[
  {
    "id": "0a807a28-b86e-43ae-9184-e95d30e39866",
    "studentId": "cb14a94b-ccb0-413b-8687-3777ec902ce8",
    "nickname": "Sinta",
    "dueDate": "2026-11-14",
    "note": "Usulan AI disetujui",
    "status": "assigned",
    "createdAt": "2026-11-14T14:31:11.931Z",
    "completedAt": null,
    "items": [
      {
        "id": "654bd091-b8a5-4444-b5a7-ec12f13ae009",
        "homeworkId": "0a807a28-b86e-43ae-9184-e95d30e39866",
        "position": 1,
        "levelId": "level-1",
        "levelTitle": "Vokal a, i, u",
        "item": "t1-i",
        "itemText": "i",
        "requiredStars": 1,
        "completedAt": null,
        "attempts": 0,
        "bestStars": 0,
        "tutorialUrl": "/tutorial/t1-i.mp4"
      },
      {
        "id": "2b231537-f538-4495-b493-cc713a1780c5",
        "homeworkId": "0a807a28-b86e-43ae-9184-e95d30e39866",
        "position": 2,
        "levelId": "level-1",
        "levelTitle": "Vokal a, i, u",
        "item": "t1-u",
        "itemText": "u",
        "requiredStars": 1,
        "completedAt": null,
        "attempts": 0,
        "bestStars": 0,
        "tutorialUrl": "/tutorial/t1-u.mp4"
      }
    ]
  }
]
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/homework/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"assignments":[{"studentId":"cb14a94b-ccb0-413b-8687-3777ec902ce8","items":[{"levelId":"level-1","item":"t1-i"},{"levelId":"level-1","item":"t1-u"}]}],"note":"Usulan AI disetujui"}'
```

</details>

### GET `/api/homework/submissions`

**PR di kelas beserta hasil pengerjaannya**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter query (opsional): `studentId` (string (uuid)), `status` ("assigned" \| "done"), `classroomId` (string (uuid))

**Respons 200:**
```json
[
  {
    "id": "bb3c3ef5-d663-48e9-a492-4445864d514b",
    "studentId": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
    "nickname": "Raka",
    "dueDate": "2026-11-14",
    "note": "Latihan 10 menit sebelum tidur",
    "status": "done",
    "createdAt": "2026-11-14T14:31:11.960Z",
    "completedAt": "2026-11-14T14:31:12.069Z",
    "items": [
      {
        "id": "c510a9c9-1761-48ed-9c22-b2046c5a01d6",
        "homeworkId": "bb3c3ef5-d663-48e9-a492-4445864d514b",
        "position": 1,
        "levelId": "level-1",
        "levelTitle": "Vokal a, i, u",
        "item": "t1-i",
        "itemText": "i",
        "requiredStars": 1,
        "completedAt": "2026-11-14T14:31:12.032Z",
        "attempts": 1,
        "bestStars": 2,
        "tutorialUrl": "/tutorial/t1-i.mp4"
      },
      {
        "id": "f2db142b-2b31-4298-a8f8-2f8317cbef7b",
        "homeworkId": "bb3c3ef5-d663-48e9-a492-4445864d514b",
        "position": 2,
        "levelId": "level-1",
        "levelTitle": "Vokal a, i, u",
        "item": "t1-u",
        "itemText": "u",
        "requiredStars": 1,
        "completedAt": "2026-11-14T14:31:12.069Z",
        "attempts": 1,
        "bestStars": 2,
        "tutorialUrl": "/tutorial/t1-u.mp4"
      }
    ]
  },
  {
    "id": "0a807a28-b86e-43ae-9184-e95d30e39866",
    "studentId": "cb14a94b-ccb0-413b-8687-3777ec902ce8",
    "nickname": "Sinta",
    "dueDate": "2026-11-14",
    "note": "Usulan AI disetujui",
    "status": "assigned",
    "createdAt": "2026-11-14T14:31:11.931Z",
    "completedAt": null,
    "items": [
      {
        "id": "654bd091-b8a5-4444-b5a7-ec12f13ae009",
        "homeworkId": "0a807a28-b86e-43ae-9184-e95d30e39866",
        "position": 1,
        "levelId": "level-1",
        "levelTitle": "Vokal a, i, u",
        "item": "t1-i",
        "itemText": "i",
        "requiredStars": 1,
  … (dipotong, lihat /docs untuk lengkapnya)
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/homework/submissions" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/teacher/rewards`

**Katalog hadiah guru**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)

**Respons 200:**
```json
[
  {
    "id": "4fc4471d-7cf6-493b-895c-c4529945e06a",
    "name": "Stiker bintang",
    "imageUrl": null,
    "costPoints": 30,
    "stock": null,
    "active": true
  },
  {
    "id": "3c93d13c-1daf-405a-b642-9974eb0d55bf",
    "name": "Pensil warna",
    "imageUrl": null,
    "costPoints": 100,
    "stock": 10,
    "active": true
  },
  {
    "id": "3d479ae4-9058-49fc-b690-cb94ef95dd48",
    "name": "Buku gambar",
    "imageUrl": null,
    "costPoints": 200,
    "stock": 5,
    "active": true
  }
]
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/teacher/rewards" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### POST `/api/teacher/rewards`

**Tambah hadiah**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `name` | string | ya | panjang min 1, panjang maks 100 |
| `costPoints` | integer | ya | min 1, maks 9007199254740991 |
| `stock` | integer atau null | tidak |  |
| `imageUrl` | string | tidak | panjang maks 2000 |

Contoh body:
```json
{
  "name": "Krayon",
  "costPoints": 50,
  "stock": 20
}
```

**Respons 201:**
```json
{
  "id": "ec631fce-0d96-4f62-a7ba-f984b28c08b5",
  "name": "Krayon",
  "imageUrl": null,
  "costPoints": 50,
  "stock": 20,
  "active": true
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/teacher/rewards" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Krayon","costPoints":50,"stock":20}'
```

</details>

### GET `/api/teacher/redemptions`

**Penukaran hadiah di kelas**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter query (opsional): `status` ("requested" \| "given")

**Respons 200:**
```json
[
  {
    "id": "1b4b102e-1983-44aa-861d-52b6b465850d",
    "studentId": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
    "nickname": "Raka",
    "rewardName": "Stiker bintang",
    "pointsSpent": 30,
    "status": "requested",
    "createdAt": "2026-11-14T14:31:11.547Z",
    "givenAt": null
  }
]
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/teacher/redemptions" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### POST `/api/teacher/redemptions/{id}/give`

**Tandai hadiah sudah diserahkan**

- Login: Butuh token **teacher** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id penukaran hadiah (UUID), dari GET /teacher/redemptions

**Respons 200:**
```json
{
  "id": "1b4b102e-1983-44aa-861d-52b6b465850d",
  "status": "given",
  "givenAt": "2026-11-14T14:31:12.219Z"
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/teacher/redemptions/{id}/give" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

---

## Aplikasi Orang Tua (mobile)

**Dipakai teman mobile (aplikasi orang tua).** Aktivasi sekali: orang tua menempel link dari guru, aplikasi mengambil token (teks setelah `/` terakhir) → `GET /invites/{token}` untuk sapaan → `POST /invites/{token}/accept` (email + sandi, langsung dapat token). Berikutnya login biasa `POST /auth/parent/login`. Lalu: anak, PR beserta video tutorial (`tutorialUrl`), streak, progres (`bestStars`), laporan mingguan AI, tanya AI.

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/auth/parent/login` | Login orang tua (setelah aktivasi lewat link undangan) |
| GET | `/api/invites/{token}` | Info link undangan: nama orang tua + anak |
| POST | `/api/invites/{token}/accept` | Orang tua mengisi Gmail + kata sandi; akun aktif dan langsung masuk |
| GET | `/api/parent/children` | Anak-anak yang tertaut |
| GET | `/api/parent/children/{id}/homework` | PR anak; tiap item punya tutorialUrl (video bentuk mulut) atau null |
| POST | `/api/parent/children/{id}/practice-token` | Token latihan di rumah (PR / latihan bebas) tanpa password gambar anak |
| GET | `/api/parent/children/{id}/streak` | Streak anak + kalender 7 hari |
| GET | `/api/parent/children/{id}/chart` | Grafik belajar anak per hari, siap digambar (sama dengan grafik di aplikasi guru) |
| GET | `/api/parent/children/{id}/progress` | Peta petualangan anak: bintang terbaik per item (tanda selesai) + tutorialUrl |
| GET | `/api/parent/children/{id}/weekly-report` | Laporan mingguan untuk orang tua (ditulis AI): yang sudah bisa, sedang dilatih, cara membantu |
| POST | `/api/parent/children/{id}/ask` | Tanya AI tentang progres anak (jawaban dari data latihan) |

### POST `/api/auth/parent/login`

**Login orang tua (setelah aktivasi lewat link undangan)**

- Login: Tanpa login.

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `email` | string (email) | ya | email valid |
| `password` | string | ya | panjang min 1, panjang maks 72 |

Contoh body:
```json
{
  "email": "ibu.sari@gmail.com",
  "password": "rahasiaSari1"
}
```

**Respons 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "role": "parent",
  "parent": {
    "id": "fb457e30-a7c2-47f0-916d-7e737132b3a3",
    "name": "Ibu Sari",
    "email": "ibu.sari@gmail.com"
  }
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/auth/parent/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ibu.sari@gmail.com","password":"rahasiaSari1"}'
```

</details>

### GET `/api/invites/{token}`

**Info link undangan: nama orang tua + anak**

- Login: Tanpa login.
- Parameter path: `{token}` = Token dari link undangan

**Respons 200:**
```json
{
  "parentName": "Ibu Sari",
  "children": ["Raka"]
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/invites/{token}"
```

</details>

### POST `/api/invites/{token}/accept`

**Orang tua mengisi Gmail + kata sandi; akun aktif dan langsung masuk**

- Login: Tanpa login.
- Parameter path: `{token}` = Token dari link undangan

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `email` | string (email) | ya | email valid |
| `password` | string | ya | panjang min 8, panjang maks 72 |

Contoh body:
```json
{
  "email": "ibu.sari@gmail.com",
  "password": "rahasiaSari1"
}
```

**Respons 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "role": "parent",
  "parent": {
    "id": "fb457e30-a7c2-47f0-916d-7e737132b3a3",
    "name": "Ibu Sari",
    "email": "ibu.sari@gmail.com"
  }
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/invites/{token}/accept" \
  -H "Content-Type: application/json" \
  -d '{"email":"ibu.sari@gmail.com","password":"rahasiaSari1"}'
```

</details>

### GET `/api/parent/children`

**Anak-anak yang tertaut**

- Login: Butuh token **parent** (`Authorization: Bearer <token>`)

**Respons 200:**
```json
[
  {
    "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
    "nickname": "Raka",
    "photoUrl": "https://contoh.id/foto/raka-baru.jpg",
    "totalPoints": 10,
    "classroomName": "Kelas 1"
  }
]
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/parent/children" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/parent/children/{id}/homework`

**PR anak; tiap item punya tutorialUrl (video bentuk mulut) atau null**

- Login: Butuh token **parent** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children
- Parameter query (opsional): `status` ("assigned" \| "done")

**Respons 200:**
```json
[
  {
    "id": "bb3c3ef5-d663-48e9-a492-4445864d514b",
    "studentId": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
    "nickname": "Raka",
    "dueDate": "2026-11-14",
    "note": "Latihan 10 menit sebelum tidur",
    "status": "assigned",
    "createdAt": "2026-11-14T14:31:11.960Z",
    "completedAt": null,
    "items": [
      {
        "id": "c510a9c9-1761-48ed-9c22-b2046c5a01d6",
        "homeworkId": "bb3c3ef5-d663-48e9-a492-4445864d514b",
        "position": 1,
        "levelId": "level-1",
        "levelTitle": "Vokal a, i, u",
        "item": "t1-i",
        "itemText": "i",
        "requiredStars": 1,
        "completedAt": null,
        "attempts": 0,
        "bestStars": 0,
        "tutorialUrl": "/tutorial/t1-i.mp4"
      },
      {
        "id": "f2db142b-2b31-4298-a8f8-2f8317cbef7b",
        "homeworkId": "bb3c3ef5-d663-48e9-a492-4445864d514b",
        "position": 2,
        "levelId": "level-1",
        "levelTitle": "Vokal a, i, u",
        "item": "t1-u",
        "itemText": "u",
        "requiredStars": 1,
        "completedAt": null,
        "attempts": 0,
        "bestStars": 0,
        "tutorialUrl": "/tutorial/t1-u.mp4"
      }
    ]
  }
]
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/parent/children/{id}/homework" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### POST `/api/parent/children/{id}/practice-token`

**Token latihan di rumah (PR / latihan bebas) tanpa password gambar anak**

- Login: Butuh token **parent** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Respons 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "role": "student",
  "student": {
    "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
    "nickname": "Raka",
    "photoUrl": "https://contoh.id/foto/raka-baru.jpg"
  }
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/parent/children/{id}/practice-token" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/parent/children/{id}/streak`

**Streak anak + kalender 7 hari**

- Login: Butuh token **parent** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Respons 200:**
```json
{
  "current": 1,
  "longest": 1,
  "lastActiveDay": "2026-11-14",
  "dailyTarget": 3,
  "todayCount": 4,
  "last7Days": [
    {
      "day": "2026-11-08",
      "count": 0,
      "active": false
    },
    {
      "day": "2026-11-09",
      "count": 0,
      "active": false
    },
    {
      "day": "2026-11-10",
      "count": 0,
      "active": false
    },
    {
      "day": "2026-11-11",
      "count": 0,
      "active": false
    },
    {
      "day": "2026-11-12",
      "count": 0,
      "active": false
    },
    {
      "day": "2026-11-13",
      "count": 0,
      "active": false
    },
    {
      "day": "2026-11-14",
      "count": 4,
      "active": true
    }
  ]
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/parent/children/{id}/streak" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/parent/children/{id}/chart`

**Grafik belajar anak per hari, siap digambar (sama dengan grafik di aplikasi guru)**

- Login: Butuh token **parent** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children
- Parameter query (opsional): `days` (integer)

**Respons 200:**
```json
{
  "days": 7,
  "labels": ["Min 8/11", "Sen 9/11", "Sel 10/11", "Rab 11/11", "Kam 12/11", "Jum 13/11", "Sab 14/11"],
  "series": {
    "attempts": [0, 0, 0, 0, 0, 0, 5],
    "correct": [0, 0, 0, 0, 0, 0, 4],
    "accuracy": [0, 0, 0, 0, 0, 0, 72],
    "points": [0, 0, 0, 0, 0, 0, 80]
  },
  "daily": [
    {
      "date": "2026-11-08",
      "attempts": 0,
      "correct": 0,
      "stars": 0,
      "accuracy": 0,
      "school": 0,
      "home": 0,
      "points": 0,
      "label": "Min 8/11"
    },
    {
      "date": "2026-11-09",
      "attempts": 0,
      "correct": 0,
      "stars": 0,
      "accuracy": 0,
      "school": 0,
      "home": 0,
      "points": 0,
      "label": "Sen 9/11"
    },
    {
      "date": "2026-11-10",
      "attempts": 0,
      "correct": 0,
      "stars": 0,
      "accuracy": 0,
      "school": 0,
      "home": 0,
      "points": 0,
      "label": "Sel 10/11"
    },
    {
      "date": "2026-11-11",
      "attempts": 0,
      "correct": 0,
      "stars": 0,
      "accuracy": 0,
      "school": 0,
      "home": 0,
      "points": 0,
      "label": "Rab 11/11"
    },
    {
      "date": "2026-11-12",
      "attempts": 0,
      "correct": 0,
      "stars": 0,
      "accuracy": 0,
  … (dipotong, lihat /docs untuk lengkapnya)
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/parent/children/{id}/chart" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/parent/children/{id}/progress`

**Peta petualangan anak: bintang terbaik per item (tanda selesai) + tutorialUrl**

- Login: Butuh token **parent** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Respons 200:**
```json
[
  {
    "id": "level-1",
    "category": "vokal",
    "orderNo": 1,
    "title": "Vokal a, i, u",
    "items": [
      {
        "id": "t1-a",
        "text": "a",
        "urutan": ["a"],
        "tingkat": 1,
        "bantuanVisual": true,
        "dinilaiSebagian": false,
        "bestStars": 3,
        "tutorialUrl": "/tutorial/t1-a.mp4"
      },
      {
        "id": "t1-i",
        "text": "i",
        "urutan": ["i"],
        "tingkat": 1,
        "bantuanVisual": true,
        "dinilaiSebagian": false,
        "bestStars": 2,
        "tutorialUrl": "/tutorial/t1-i.mp4"
      },
      {
        "id": "t1-u",
        "text": "u",
        "urutan": ["u"],
        "tingkat": 1,
        "bantuanVisual": true,
        "dinilaiSebagian": false,
        "bestStars": 2,
        "tutorialUrl": "/tutorial/t1-u.mp4"
      },
      {
        "id": "t2-a",
        "text": "a",
        "urutan": ["a"],
        "tingkat": 2,
        "bantuanVisual": false,
        "dinilaiSebagian": false,
        "bestStars": 0,
        "tutorialUrl": null
      },
      {
        "id": "t2-i",
        "text": "i",
        "urutan": ["i"],
        "tingkat": 2,
        "bantuanVisual": false,
        "dinilaiSebagian": false,
        "bestStars": 0,
        "tutorialUrl": null
      },
      {
        "id": "t2-u",
        "text": "u",
  … (dipotong, lihat /docs untuk lengkapnya)
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/parent/children/{id}/progress" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/parent/children/{id}/weekly-report`

**Laporan mingguan untuk orang tua (ditulis AI): yang sudah bisa, sedang dilatih, cara membantu**

- Login: Butuh token **parent** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Respons 200:**
```json
{
  "achieved": "Raka sudah bisa mengucapkan bunyi suara dengan melihat bantuan gambar yang ada.",
  "practising": "Raka sedang berlatih mengucapkan bunyi suara lain dengan bantuan gambar yang sama.",
  "howToHelp": "Ucapkan kata pelan-pelan lebih dulu, lalu minta Raka meniru sambil melihat cermin.",
  "practiceDays": 1,
  "references": [],
  "writer": "llm",
  "source": "ai"
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/parent/children/{id}/weekly-report" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### POST `/api/parent/children/{id}/ask`

**Tanya AI tentang progres anak (jawaban dari data latihan)**

- Login: Butuh token **parent** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id anak (UUID), dari GET /classroom/students atau GET /parent/children

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `question` | string | ya | panjang min 3, panjang maks 300 |

Contoh body:
```json
{
  "question": "Apa yang bisa kami latih di rumah?"
}
```

**Respons 200:**
```json
{
  "answer": "Halo! Berdasarkan data latihan, bunyi yang paling perlu perhatian bagi Raka adalah bunyi i karena masih lemah dan sedang dilatih pada tahap bunyi tunggal dengan bantuan gambar.",
  "references": [],
  "writer": "llm",
  "source": "ai"
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/parent/children/{id}/ask" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"Apa yang bisa kami latih di rumah?"}'
```

</details>

---

## Web Anak (laptop sekolah)

**Dipakai web anak di laptop sekolah.** Laptop memakai token perangkat kelas (tanpa login guru) → pilih karakter → PIN 3 gambar → token anak → peta petualangan (4 kategori, level terbuka dari bintang) → Mari Berlatih (kamera Mata + video tutorial) → `POST /attempts` → pop up bintang & poin.

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/auth/teacher/login` | Login guru (aplikasi guru / mode kelas di laptop) |
| POST | `/api/auth/student/login` | Login anak di perangkat kelas: id anak + PIN 3 gambar (nomor 1-9). Salah 5x = terkunci. Token guru atau token perangkat kelas |
| GET | `/api/classroom/students` | Daftar anak di kelas (layar pilih profil). Token perangkat kelas selalu melihat kelasnya sendiri |
| GET | `/api/me/student` | Profil anak, poin, streak |
| PUT | `/api/me/calibration` | Simpan model bibir personal dari komponen Mata (ModelBibir); diteruskan ke layanan AI |
| GET | `/api/me/calibration` | Ambil model bibir personal anak (null kalau belum dilatih), untuk dimuat Mata saat login |
| GET | `/api/levels` | Peta petualangan: 6 level, tiap item berisi bintang terbaik + tutorialUrl (video). Level terbuka kalau level sebelumnya >= 1 bintang |
| POST | `/api/attempts` | Kirim hasil satu percobaan dari Mata (+ itemId). Mengembalikan bintang, poin, streak, status PR, dan item berikutnya dari AI |
| GET | `/api/rewards` | Toko hadiah: poin, katalog, riwayat penukaran |
| POST | `/api/rewards/{id}/redeem` | Tukar poin dengan hadiah |

### POST `/api/auth/teacher/login`

**Login guru (aplikasi guru / mode kelas di laptop)**

- Login: Tanpa login.

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `email` | string (email) | ya | email valid |
| `password` | string | ya | panjang min 1, panjang maks 72 |

Contoh body:
```json
{
  "email": "guru@satu.id",
  "password": "gurusatu!"
}
```

**Respons 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "role": "teacher",
  "teacher": {
    "id": "11c50368-e20c-4b5d-a9d3-ce972667a4b6",
    "name": "Bu Rina",
    "email": "guru@satu.id"
  },
  "classroom": {
    "id": "a21e5dc3-515b-4f56-9750-d379c00064e8",
    "name": "Kelas 1"
  },
  "classrooms": [
    {
      "id": "a21e5dc3-515b-4f56-9750-d379c00064e8",
      "name": "Kelas 1",
      "createdAt": "2026-11-14T14:31:10.910Z",
      "studentCount": 0
    }
  ]
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/auth/teacher/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"guru@satu.id","password":"gurusatu!"}'
```

</details>

### POST `/api/auth/student/login`

**Login anak di perangkat kelas: id anak + PIN 3 gambar (nomor 1-9). Salah 5x = terkunci. Token guru atau token perangkat kelas**

- Login: Butuh token **teacher / device** (`Authorization: Bearer <token>`)

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `studentId` | string (uuid) | ya | UUID |
| `picturePassword` | array of integer | ya | min 3 isi, maks 3 isi, tiap isi 1–9 |

Contoh body:
```json
{
  "studentId": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
  "picturePassword": [2, 5, 8]
}
```

**Respons 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "role": "student",
  "student": {
    "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
    "nickname": "Raka",
    "photoUrl": "https://contoh.id/foto/raka-baru.jpg",
    "isLocked": false
  }
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/auth/student/login" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a","picturePassword":[2,5,8]}'
```

</details>

### GET `/api/classroom/students`

**Daftar anak di kelas (layar pilih profil). Token perangkat kelas selalu melihat kelasnya sendiri**

- Login: Butuh token **teacher / device** (`Authorization: Bearer <token>`)
- Parameter query (opsional): `classroomId` (string (uuid))

**Respons 200:**
```json
[
  {
    "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
    "nickname": "Raka",
    "photoUrl": "https://contoh.id/foto/raka-baru.jpg",
    "isLocked": false
  },
  {
    "id": "cb14a94b-ccb0-413b-8687-3777ec902ce8",
    "nickname": "Sinta",
    "photoUrl": null,
    "isLocked": false
  }
]
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/classroom/students" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/me/student`

**Profil anak, poin, streak**

- Login: Butuh token **student** (`Authorization: Bearer <token>`)

**Respons 200:**
```json
{
  "id": "cdd632a6-12a5-4ba0-9c36-d0ff99d9c10a",
  "nickname": "Raka",
  "photoUrl": "https://contoh.id/foto/raka-baru.jpg",
  "totalPoints": 40,
  "calibration": {
    "kelas": ["a", "i", "u"],
    "pusat": [
      [0.41, 0.05, 0.02, 0, 0.3],
      [0.12, 0.02, 0.18, 0, 0.1],
      [0.1, 0.52, 0, 0, 0.1]
    ],
    "skala": [0.08, 0.08, 0.08, 0.05, 0.08],
    "versi": 1,
    "jumlah": [6, 6, 6],
    "akurasi": 0.91
  },
  "classroomName": "Kelas 1",
  "streak": {
    "current": 0,
    "longest": 0,
    "lastActiveDay": null,
    "dailyTarget": 3,
    "todayCount": 2,
    "last7Days": [
      {
        "day": "2026-11-08",
        "count": 0,
        "active": false
      },
      {
        "day": "2026-11-09",
        "count": 0,
        "active": false
      },
      {
        "day": "2026-11-10",
        "count": 0,
        "active": false
      },
      {
        "day": "2026-11-11",
        "count": 0,
        "active": false
      },
      {
        "day": "2026-11-12",
        "count": 0,
        "active": false
      },
      {
        "day": "2026-11-13",
        "count": 0,
        "active": false
      },
      {
        "day": "2026-11-14",
        "count": 2,
        "active": false
      }
  … (dipotong, lihat /docs untuk lengkapnya)
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/me/student" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### PUT `/api/me/calibration`

**Simpan model bibir personal dari komponen Mata (ModelBibir); diteruskan ke layanan AI**

- Login: Butuh token **student** (`Authorization: Bearer <token>`)

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `versi` | number | ya |  |
| `kelas` | array of string | ya | min 2 isi, maks 10 isi |
| `pusat` | array of array of number | ya | min 2 isi, maks 10 isi |
| `skala` | array of number | ya | min 1 isi, maks 12 isi |
| `jumlah` | array of integer | tidak | maks 10 isi, tiap isi -9007199254740991–9007199254740991 |
| `akurasi` | number | tidak | min 0, maks 1 |

Contoh body:
```json
{
  "versi": 1,
  "kelas": ["a", "i", "u"],
  "pusat": [
    [0.41, 0.05, 0.02, 0, 0.3],
    [0.12, 0.02, 0.18, 0, 0.1],
    [0.1, 0.52, 0, 0, 0.1]
  ],
  "skala": [0.08, 0.08, 0.08, 0.05, 0.08],
  "jumlah": [6, 6, 6],
  "akurasi": 0.91
}
```

**Respons 200:**
```json
{
  "saved": true
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X PUT "https://tunarungu.neotelemetri.id/api/me/calibration" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"versi":1,"kelas":["a","i","u"],"pusat":[[0.41,0.05,0.02,0,0.3],[0.12,0.02,0.18,0,0.1],[0.1,0.52,0,0,0.1]],"skala":[0.08,0.08,0.08,0.05,0.08],"jumlah":[6,6,6],"akurasi":0.91}'
```

</details>

### GET `/api/me/calibration`

**Ambil model bibir personal anak (null kalau belum dilatih), untuk dimuat Mata saat login**

- Login: Butuh token **student** (`Authorization: Bearer <token>`)

**Respons 200:**
```json
{
  "model": {
    "kelas": ["a", "i", "u"],
    "pusat": [
      [0.41, 0.05, 0.02, 0, 0.3],
      [0.12, 0.02, 0.18, 0, 0.1],
      [0.1, 0.52, 0, 0, 0.1]
    ],
    "skala": [0.08, 0.08, 0.08, 0.05, 0.08],
    "versi": 1,
    "jumlah": [6, 6, 6],
    "akurasi": 0.91
  }
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/me/calibration" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### GET `/api/levels`

**Peta petualangan: 6 level, tiap item berisi bintang terbaik + tutorialUrl (video). Level terbuka kalau level sebelumnya >= 1 bintang**

- Login: Butuh token **student** (`Authorization: Bearer <token>`)

**Respons 200:**
```json
[
  {
    "id": "level-1",
    "category": "vokal",
    "orderNo": 1,
    "title": "Vokal a, i, u",
    "items": [
      {
        "id": "t1-a",
        "text": "a",
        "urutan": ["a"],
        "tingkat": 1,
        "bantuanVisual": true,
        "dinilaiSebagian": false,
        "bestStars": 0,
        "tutorialUrl": "/tutorial/t1-a.mp4"
      },
      {
        "id": "t1-i",
        "text": "i",
        "urutan": ["i"],
        "tingkat": 1,
        "bantuanVisual": true,
        "dinilaiSebagian": false,
        "bestStars": 0,
        "tutorialUrl": "/tutorial/t1-i.mp4"
      },
      {
        "id": "t1-u",
        "text": "u",
        "urutan": ["u"],
        "tingkat": 1,
        "bantuanVisual": true,
        "dinilaiSebagian": false,
        "bestStars": 0,
        "tutorialUrl": "/tutorial/t1-u.mp4"
      },
      {
        "id": "t2-a",
        "text": "a",
        "urutan": ["a"],
        "tingkat": 2,
        "bantuanVisual": false,
        "dinilaiSebagian": false,
        "bestStars": 0,
        "tutorialUrl": null
      },
      {
        "id": "t2-i",
        "text": "i",
        "urutan": ["i"],
        "tingkat": 2,
        "bantuanVisual": false,
        "dinilaiSebagian": false,
        "bestStars": 0,
        "tutorialUrl": null
      },
      {
        "id": "t2-u",
        "text": "u",
  … (dipotong, lihat /docs untuk lengkapnya)
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/levels" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### POST `/api/attempts`

**Kirim hasil satu percobaan dari Mata (+ itemId). Mengembalikan bintang, poin, streak, status PR, dan item berikutnya dari AI**

- Login: Butuh token **student** (`Authorization: Bearer <token>`)

**Body (JSON):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `itemId` | string | ya | panjang min 1, panjang maks 50 |
| `berhasil` | boolean | ya |  |
| `langkah_tercapai` | integer | ya | min 0, maks 50 |
| `durasi_ms` | integer | tidak | min 0, maks 600000 |
| `kemiripan` | number | ya | min 0, maks 1 |
| `bintang` | integer | tidak | min 1, maks 3 |
| `poin` | number | tidak |  |
| `homeworkItemId` | string (uuid) | tidak | UUID |

Contoh body:
```json
{
  "itemId": "t1-a",
  "berhasil": true,
  "langkah_tercapai": 1,
  "durasi_ms": 1800,
  "kemiripan": 0.92
}
```

**Respons 201:**
```json
{
  "itemId": "t1-a",
  "levelId": "level-1",
  "stars": 3,
  "correct": true,
  "accuracy": 92,
  "bestStars": 3,
  "pointsEarned": 30,
  "totalPoints": 40,
  "dailyCount": 2,
  "dailyTarget": 3,
  "streak": {
    "current": 0,
    "longest": 0
  },
  "homeworkDone": false,
  "mastery": [
    {
      "bunyi": "a",
      "tingkat": 1,
      "berhasil": true,
      "sebelum": 0.7693,
      "sesudah": 0.9008,
      "label": "sudah_bisa"
    }
  ],
  "rest": {
    "suggested": false,
    "reasons": []
  },
  "next": {
    "item": {
      "id": "t1-i",
      "text": "i",
      "tingkat": 1,
      "urutan": ["i"],
      "bantuanVisual": true,
      "dinilaiSebagian": false
    },
    "levelId": "level-1",
    "reason": "zona",
    "expectedSuccess": 0.515,
    "rest": false
  },
  "source": "ai"
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/attempts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"itemId":"t1-a","berhasil":true,"langkah_tercapai":1,"durasi_ms":1800,"kemiripan":0.92}'
```

</details>

### GET `/api/rewards`

**Toko hadiah: poin, katalog, riwayat penukaran**

- Login: Butuh token **student** (`Authorization: Bearer <token>`)

**Respons 200:**
```json
{
  "totalPoints": 40,
  "rewards": [
    {
      "id": "4fc4471d-7cf6-493b-895c-c4529945e06a",
      "name": "Stiker bintang",
      "imageUrl": null,
      "costPoints": 30,
      "stock": null,
      "active": true
    },
    {
      "id": "3c93d13c-1daf-405a-b642-9974eb0d55bf",
      "name": "Pensil warna",
      "imageUrl": null,
      "costPoints": 100,
      "stock": 10,
      "active": true
    },
    {
      "id": "3d479ae4-9058-49fc-b690-cb94ef95dd48",
      "name": "Buku gambar",
      "imageUrl": null,
      "costPoints": 200,
      "stock": 5,
      "active": true
    }
  ],
  "redemptions": []
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X GET "https://tunarungu.neotelemetri.id/api/rewards" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

### POST `/api/rewards/{id}/redeem`

**Tukar poin dengan hadiah**

- Login: Butuh token **student** (`Authorization: Bearer <token>`)
- Parameter path: `{id}` = Id hadiah (UUID), dari GET /rewards

**Respons 201:**
```json
{
  "redemption": {
    "id": "1b4b102e-1983-44aa-861d-52b6b465850d",
    "rewardId": "4fc4471d-7cf6-493b-895c-c4529945e06a",
    "pointsSpent": 30,
    "status": "requested",
    "createdAt": "2026-11-14T14:31:11.547Z"
  },
  "totalPoints": 10
}
```

<details><summary>Coba dengan curl</summary>

```bash
curl -X POST "https://tunarungu.neotelemetri.id/api/rewards/{id}/redeem" \
  -H "Authorization: Bearer $TOKEN"
```

</details>

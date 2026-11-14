# SATU — Sahabat Tunarungu

Ekosistem latihan bicara berbasis AI untuk anak tunarungu: anak berlatih di sekolah dan di rumah,
guru memantau dan memberi tugas, orang tua mendampingi.

> Setiap bagian `##` di bawah = satu slide.

---

## 1. Masalah dan solusi

**Masalah**
- Anak tunarungu belajar bicara dari **bentuk bibir**, tapi tidak bisa mendengar suaranya sendiri untuk mengoreksi.
- Latihan bergantung pada guru di kelas; di rumah orang tua tidak tahu cara membantu.
- Guru sulit memantau perkembangan tiap anak secara rinci.

**Solusi: SATU**
- **Cermin Ajaib**: kamera membaca bentuk bibir anak dan memberi arahan langsung (titik bibir, panah, kemiripan).
- **AI** memilih latihan berikutnya, mengusulkan tugas, dan menulis laporan untuk guru dan orang tua.
- **Tiga aplikasi, satu data**: web anak, aplikasi guru, aplikasi orang tua.

---

## 2. Tiga pengguna, tiga aplikasi

| Pengguna | Aplikasi | Yang dilakukan |
|---|---|---|
| **Anak** | Web (laptop sekolah / HP di rumah) | Pilih karakter → PIN gambar → Peta Petualangan → Mari Berlatih (Cermin Ajaib) → bintang & poin → Toko Hadiah |
| **Guru** | Aplikasi Android | Kelola kelas & anak, link orang tua, pantau tabel bunyi & grafik, atur level, kirim tugas dari usulan AI, kelola hadiah |
| **Orang tua** | Aplikasi Android | Aktivasi lewat link guru, lihat tugas + video tutorial, grafik harian, laporan mingguan AI, tanya AI |

---

## 3. Arsitektur sistem

```
 Web Anak (React)          Aplikasi Guru (Kotlin)      Aplikasi Orang Tua (Kotlin)
 + Mata (kamera, on-device)        |                            |
        |                          |                            |
        +------------- HTTPS: https://tunarungu.neotelemetri.id/api ------------+
                                   |
                       Cloudflare -> Nginx (aaPanel)
                                   |
                    Backend SATU (Express + TypeScript)
                    4 proses (pm2 cluster), port 3107
                     |                             |
        Supabase (PostgreSQL)              Layanan AI (FastAPI, Python)
        akun, latihan, bintang,            127.0.0.1:7777 (tidak dibuka ke internet)
        tugas, hadiah                      BKT (penguasaan bunyi) + LLM (laporan)
```

- **Satu backend untuk semua aplikasi**; aplikasi tidak pernah menyentuh database langsung.
- **Video kamera tidak pernah dikirim**: Mata menilai di perangkat, yang dikirim hanya angka hasil (berhasil, kemiripan, durasi).

---

## 4. Teknologi

| Bagian | Teknologi |
|---|---|
| Web anak | React 19, TypeScript, Vite, font Gluten |
| Penilaian bibir (Mata) | MediaPipe Face Landmarker (478 titik wajah + blendshape), Web Audio (suara/napas) |
| Backend | Node.js, Express 5, TypeScript, Zod (validasi), JWT (login), bcrypt (sandi & PIN) |
| Database | Supabase PostgreSQL, RLS aktif (tidak bisa diakses dari luar backend) |
| Layanan AI | Python FastAPI: Bayesian Knowledge Tracing (BKT) + LLM untuk saran & laporan |
| Aplikasi mobile | Kotlin (Android), Jetpack Compose |
| Server | VPS 4 vCPU, pm2 (4 proses backend + 1 layanan AI), Nginx, Cloudflare (HTTPS) |
| Dokumentasi API | Swagger otomatis di `/docs` + `API-LENGKAP.md` |

---

## 5. Alur anak: masuk tanpa sandi teks

1. **Pilih Karakter**: laptop kelas memakai *token perangkat* (tanpa login guru), menampilkan foto anak sekelas.
2. **PIN Gambar**: anak mengetuk 3 dari 9 gambar (bintang, matahari, mobil, …), boleh berulang.
3. Salah 5× → profil terkunci, layar "Minta Bantuan Guru"; terbuka otomatis begitu guru membuka kunci dari HP.
4. Masuk → **Peta Petualangan** dengan poin anak.

Kenapa gambar? Anak usia dini dan tunarungu lebih mudah mengingat gambar daripada huruf/angka.

---

## 6. Peta Petualangan

- **4 kategori** di jalur peta: Huruf Vokal → Huruf Konsonan → Suku Kata → Kata 2 Suku Kata.
- Tiap kategori berisi **5 latihan bernomor** (mis. a, i, u, e, o) dengan **bintang** (1–3) di atas yang sudah selesai.
- **Level terbuka dari bintang**: kategori berikutnya terbuka setelah ada latihan berbintang di level sebelumnya.
- **Guru bisa membuka atau mengunci level per anak** (`maxLevel`), mis. anak yang sudah lancar langsung ke Suku Kata.
- Kurikulum: **6 level, 98 latihan**, dari layanan AI.

---

## 7. Mari Berlatih: Cermin Ajaib

```
Kamera → MediaPipe (titik bibir) → 5 ukuran bibir (rahang, bulat, lebar, tekan, celah)
       → dibanding wajah netral anak (kalibrasi 2 detik) → aturan bentuk tiap bunyi
       → Kemiripan 0–100% + arahan → tahan 0,7 detik → BERHASIL
```

Yang dilihat anak:
- **Titik bibir** di wajahnya: hijau = pas, oranye = belum.
- **Titik acuan biru** = bentuk bibir target, diselaraskan ke mulut anak.
- **Panah kuning** di titik yang harus digerakkan (buka, tarik ke samping, kerucutkan, rapatkan).
- Status **✓ Bentuk** + bilah **Tahan** + kalimat arahan ("Buka mulut lebih lebar").
- **Video tutorial** bentuk mulut untuk latihan itu di kotak Tutorial.
- Untuk kata (mis. "mama"), dinilai bunyi demi bunyi: m → a → m → a.

---

## 8. Penilaian, bintang, dan poin

| Akurasi (kemiripan rata-rata) | Hasil | Bintang | Poin |
|---|---|---|---|
| < 50% | Belum benar → ulang, dengan pesan kesalahan & perbaikan | 0 | 0 |
| 50–69% | Benar | 1 | 10 |
| 70–89% | Benar | 2 | 20 |
| 90–100% | Benar | 3 | 30 |

- Bintang dan poin **dihitung server**, tidak bisa dipalsukan dari aplikasi.
- Benar → **pop up Selamat** (bintang, akurasi, poin) dengan tombol Ulangi / Lanjut.
- Poin ditukar di **Toko Hadiah** (pensil, buku, permen, kue, buah); guru menyerahkan hadiah di kelas.

---

## 9. Peran AI

| AI | Di mana | Fungsi |
|---|---|---|
| **Mata** (visi komputer) | Perangkat anak | Membaca bentuk bibir, kemiripan, arahan per titik |
| **BKT** (Bayesian Knowledge Tracing) | Layanan AI | Memperkirakan penguasaan tiap bunyi; memilih latihan berikutnya di "zona belajar" (~78% peluang berhasil); deteksi lelah |
| **LLM** | Layanan AI | Ringkasan kelas & anak untuk guru, saran belajar, laporan mingguan orang tua, tanya-jawab tentang anak |
| **Usulan tugas** | Layanan AI + backend | AI mengusulkan latihan per anak; backend menyaring yang sudah 3 bintang atau levelnya terkunci |

- Jika layanan AI mati/lambat, backend memakai **aturan cadangan** sehingga aplikasi tetap berjalan (`source: "fallback"`).
- Layanan AI dipulihkan otomatis dari riwayat database jika restart.

---

## 10. Alur guru

1. **Login** → pilih / tambah kelas.
2. **Tambah anak**: nama, foto, PIN gambar → otomatis dapat **link aktivasi orang tua** (sekali pakai, 7 hari).
3. **Pantau**:
   - Tabel kelas: tiap anak × bunyi (a, i, u, e, o, m, f, …) dengan centang "sudah bisa".
   - Report anak: hari latihan 7 hari, poin, streak, **grafik harian**.
   - Ringkasan AI per anak dan per kelas.
4. **Kendali manual**: reset PIN, buka profil terkunci, atur level, ganti foto.
5. **Tugas**: usulan AI untuk seluruh kelas → **Setuju Semua** → terkirim ke tiap anak & orang tuanya.
6. **Hadiah**: kelola katalog, tandai hadiah sudah diserahkan.

---

## 11. Alur orang tua

1. Terima **link undangan** dari guru → tempel di aplikasi → buat email + sandi → langsung masuk.
2. Lihat **tugas** anak, lengkap dengan **video tutorial** bentuk mulut per latihan.
3. Anak berlatih di rumah; latihan yang benar **otomatis menyelesaikan tugas** → guru melihat hasilnya.
4. **Grafik harian** (latihan, benar, akurasi, poin), streak, dan **laporan mingguan AI**: yang sudah bisa,
   yang sedang dilatih, dan cara membantu di rumah.
5. **Tanya AI**: "Bunyi apa yang paling sulit untuk anak saya?"

---

## 12. Alur data satu latihan (ujung ke ujung)

```
Anak latihan "u" di web
  → Mata menilai di laptop: berhasil, kemiripan 0,92, durasi 1,8 detik
  → POST /api/attempts (hanya angka, tanpa video)
  → Backend: bintang 3, poin +30, streak, tugas "u" selesai (jika ada)
  → Disimpan di Supabase
  → Diteruskan ke layanan AI: penguasaan bunyi "u" diperbarui, latihan berikutnya dipilih
  → Web menampilkan pop up Selamat + latihan berikutnya
  → Guru & orang tua melihat bintang, grafik, dan tugas yang selesai
```

---

## 13. Keamanan dan privasi

- **Video & suara tidak pernah keluar dari perangkat** anak; hanya hasil angka yang dikirim.
- Sandi dan PIN gambar disimpan sebagai **hash bcrypt**; login gagal berulang dibatasi.
- Token per peran (guru 7 hari, orang tua 30 hari, anak 3 jam, perangkat kelas 90 hari); token perangkat kelas
  hanya bisa membuka daftar anak dan login PIN.
- Setiap data dicek kepemilikannya: guru hanya melihat anak di kelasnya, orang tua hanya anaknya sendiri.
- Database dengan **RLS aktif**: tidak bisa diakses dari luar backend. Layanan AI tidak dibuka ke internet.
- HTTPS melalui Cloudflare.

---

## 14. Deployment

| Komponen | Lokasi |
|---|---|
| API + Swagger | `https://tunarungu.neotelemetri.id/api`, `/docs` |
| Backend | VPS, pm2 cluster 4 proses (port 3107) |
| Layanan AI | VPS, pm2 1 proses (127.0.0.1:7777) |
| Database | Supabase (PostgreSQL) |
| Video tutorial | `https://tunarungu.neotelemetri.id/tutorial/<id-latihan>.mp4` |
| Web anak | Vite (React), memanggil API yang sama |

Kualitas: ~100 tes otomatis backend (database PostgreSQL di memori + layanan AI tiruan), dokumentasi API dibuat otomatis dari kode.

---

## 15. Keterbatasan dan langkah berikutnya

- **Validasi akurasi pada anak tunarungu** sungguhan: ambang bentuk bibir masih dari uji orang dewasa.
- **Model bibir personal** per anak (sudah didukung Mata, perlu layar penyetelan).
- Penilaian **huruf lidah** (t, d, n, l, r, k, g) masih sebagian, karena kamera tidak melihat lidah.
- Penilaian **suara** dimatikan sementara karena ruang demo bising.
- Tambah latihan w, y, dan kata 2 suku kata lain ke kurikulum; ilustrasi tutorial per kata.
- Notifikasi tugas ke orang tua, reset sandi orang tua.

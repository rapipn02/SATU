# Database SATU (Supabase)

## Pasang

1. Buat project di Supabase (region Singapura).
2. Dashboard → **Connect** → salin connection string **Session pooler**, lalu isi `DATABASE_URL` di `be/.env`.
   Backend memakai koneksi Postgres langsung (node-postgres), bukan Project URL + service_role key.
   Simpan hanya di `.env` backend; jangan taruh di frontend.
3. Buat tabel, pilih **salah satu** cara (jangan dua-duanya):
   - **Dari backend (disarankan):** `npm run migrate`, lalu buat akun guru dengan
     `npm run seed -- --email guru@sekolah.id --password "minimal8karakter"`.
   - **Manual di SQL Editor:** jalankan berurutan `migrations/001_init.sql`, `migrations/002_levels.sql`,
     lalu `seed.sql` (ganti email & kata sandi dulu). Migrasi berikutnya (`003_…` dst.) juga dijalankan
     manual di SQL Editor. Jangan memakai `npm run migrate` di database ini: ia tidak tahu 001/002 sudah
     dijalankan dan akan mencoba membuat ulang tabel.
   - **Migrasi terbaru:** `003_teacher_creates_students.sql` (nomor WhatsApp orang tua) dan
     `004_ml_curriculum.sql` (kurikulum milik layanan AI: 6 level, 98 item; poin per item; `record_attempt` baru).
     **004 menghapus** percobaan, PR, dan progres level lama karena id berubah; akun, anak, dan hadiah aman.
     Cek status dengan `npm run check:db` (kolom `migration_003` dan `migration_004`).

## Tabel

| Tabel | Isi |
|---|---|
| `teachers`, `classrooms` | Akun guru (dari seed) dan kelasnya |
| `students` | Anak; password gambar (hash), kunci login, total poin, kalibrasi wajah |
| `parents`, `parent_students`, `parent_invites` | Orang tua dibuat guru (nama + anak), aktif lewat link undangan |
| `levels`, `level_progress` | Peta petualangan dan bintang terbaik per level |
| `attempts` | Setiap percobaan (skor, bintang, sekolah/rumah) — tanpa video |
| `homework`, `homework_items` | PR dari guru dan item katanya |
| `daily_activity`, `streaks` | Streak harian (WIB) |
| `rewards`, `reward_redemptions` | Katalog hadiah dan penukaran poin |
| `ai_insights` | Cache ringkasan AI per anak / per kelas |

## Fungsi untuk backend

```ts
// Catat percobaan: progres + poin + streak + PR dalam satu transaksi
const { data, error } = await supabase.rpc('record_attempt', {
  p_student_id, p_level_id: 'vokal-1', p_item: 'a', p_score: 88, p_stars: 2,
  p_source: 'school', p_homework_item_id: null, p_min_daily: 3,
});
// data: { points_earned, total_points, best_stars, daily_count, streak_current, streak_longest, homework_done }

// Tukar hadiah: gagal dengan NOT_ENOUGH_POINTS / OUT_OF_STOCK / REWARD_NOT_FOUND
const { data, error } = await supabase.rpc('redeem_reward', { p_student_id, p_reward_id });
```

## Aturan

- **PIN gambar:** 3 ketukan pada 9 gambar bernomor 1–9 (boleh berulang, urutan menentukan). Backend menyimpan bcrypt dari `"a-b-c"`. Salah 5× → `is_locked = true`.
- **Akun anak** dibuat guru (aplikasi mobile), termasuk `parent_whatsapp` (format `62812…`, migrasi `003`).
- **Poin:** bintang × 10 tiap percobaan (1 bintang 10, 2 bintang 20, 3 bintang 30). Migrasi `006_points_per_attempt.sql`.
- **Bintang:** benar = berhasil dan akurasi ≥ 50%; di bawah 50% 0 bintang (0 poin); 50–69% 1 bintang, 70–89% 2 bintang, 90–100% 3 bintang (dihitung server).
- **Streak:** naik saat latihan lulus (≥1 bintang) ke-3 pada hari itu (WIB). Saat menampilkan, kalau
  `last_active_day` lebih lama dari kemarin, tampilkan streak 0 (sudah putus).
- **Level terbuka:** `unlock_after_level_id` null, atau level itu sudah ≥1 bintang.
- **Link undangan:** backend membuat token acak, mengirim token mentah di link, dan menyimpan **SHA-256 hex** di `parent_invites.token_hash`.
- **Keamanan:** RLS aktif tanpa policy di semua tabel, jadi API publik Supabase (anon key) tidak bisa mengakses data. Hanya backend dengan service role key yang bisa.

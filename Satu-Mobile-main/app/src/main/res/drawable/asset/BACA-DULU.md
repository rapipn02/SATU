# Paket halaman "Mari Berlatih" (Cermin Ajaib)

Ini kode web (React + TypeScript). Isinya: kamera, deteksi bibir, penilaian ucapan, gambar titik bibir
dan arahan, kemiripan, dan popup berhasil.

## Isi folder
| Berkas | Fungsi |
|---|---|
| `model/face_landmarker.task` | **Model MediaPipe Face Landmarker** (3,7 MB). Mengenali 478 titik wajah + blendshape |
| `wasm/*` | Mesin MediaPipe untuk browser (29 MB). Hanya dibutuhkan versi web |
| `mata/` | **Mata**: kamera + mikrofon + penilaian, dibuat teman ML. `aturan.ts` = batas bentuk tiap bunyi, `percobaan.ts` = kapan berhasil/gagal, `fitur.ts` = hitung 5 ukuran bibir, `kalibrasi.ts` = wajah netral, `suara.ts` = deteksi suara/napas, `model.ts` = model bibir personal, `tutorial.ts` = bentuk bibir acuan |
| `cermin.ts` | Menggambar titik bibir anak (hijau/oranye), titik acuan biru, panah arahan kuning di atas video |
| `mata-session.ts` | Memuat model sekali per sesi |
| `layar/MariBerlatih.tsx` | Halaman penuh: Cermin Ajaib, status Bentuk/Suara/Tahan, Kemiripan, meter Suara, popup berhasil |
| `gaya/mari-berlatih.css` | Gaya halaman dan popup (potongan dari `index.css`) |

## Alur satu percobaan
1. `Mata.buat({ wasmPath: '/wasm', modelPath: '/model/face_landmarker.task' })` lalu `mata.mulaiKamera(videoEl)`.
2. Pertama kali: `mata.kalibrasi()` (anak diam, mulut tertutup ±2 detik).
3. `mata.percobaan(urutanBunyi, padaKeadaan)` mengembalikan `{ hasil, batal }`.
   `urutanBunyi` dari API, contoh `["M","a"]`. `padaKeadaan` dipanggil tiap frame (bentuk cocok? petunjuk? progres tahan? kemiripan?).
4. Hasil dikirim ke backend: `POST /api/attempts` dengan
   `{ itemId, berhasil, langkah_tercapai, durasi_ms, kemiripan }` (token anak). Jawaban: `stars`, `pointsEarned`, `totalPoints`.
5. Model bibir personal: `GET /api/me/calibration` saat masuk, `PUT /api/me/calibration` setelah percobaan berhasil.

## Syarat berhasil (percobaan.ts)
Bentuk bibir cocok **dan** bersuara (h/desis: hembusan napas), ditahan 0,7 detik untuk bunyi tunggal
(kata: 0,15 detik per vokal). Batas waktu 6 detik. Kemiripan hanya mengukur bentuk bibir.

## PENTING untuk aplikasi mobile
- Kode ini memakai `@mediapipe/tasks-vision` (versi **web**), `getUserMedia`, dan `AudioContext`. Itu jalan di
  browser atau **WebView**, bukan di Flutter/React Native native.
- Cara tercepat: tampilkan halaman web ini di WebView (perlu izin kamera + mikrofon dan HTTPS).
- Kalau harus native: pakai MediaPipe Tasks Face Landmarker untuk Android/iOS (model `.task` yang sama), lalu
  port logika murni TypeScript di `mata/` (`aturan.ts`, `fitur.ts`, `percobaan.ts`, `kalibrasi.ts`, `tipe.ts`,
  `model.ts`). File-file itu tidak memakai DOM dan hanya berisi perhitungan.
- Deteksi suara (`suara.ts`) memakai Web Audio; di native perlu diganti dengan RMS dari mikrofon dan zero-crossing.
- `mata/mata.ts` di paket ini sudah saya ubah dari versi asli: frame membawa `titik` (koordinat bibir) dan
  `ambangSuara`, untuk digambar. Penilaiannya tidak berubah.

## Dependensi web
`react`, `react-dom`, `@mediapipe/tasks-vision` (^0.10). TypeScript: `erasableSyntaxOnly` harus `false`
(kelas Mata memakai parameter properties).

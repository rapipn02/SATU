-- =====================================================================
-- Guru membuat akun anak (bukan anak mendaftar sendiri) + nomor WhatsApp orang tua.
-- Jalankan di Supabase SQL Editor setelah 001 dan 002.
-- =====================================================================

-- Nomor disimpan dalam format internasional tanpa "+": 62812xxxxxxx (dinormalisasi backend).
alter table public.students
  add column if not exists parent_whatsapp text
  check (parent_whatsapp ~ '^62[0-9]{8,13}$');

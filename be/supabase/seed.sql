-- =====================================================================
-- Data demo: akun guru (dibuat langsung), satu kelas, dan contoh hadiah.
-- Jalankan SETELAH 001_init.sql dan 002_levels.sql.
-- GANTI email dan kata sandi di bawah sebelum dipakai. Hash bcrypt dibuat
-- oleh pgcrypto ($2a$), kompatibel dengan bcrypt/bcryptjs di Node.
-- =====================================================================

with t as (
  insert into public.teachers (name, email, password_hash)
  values ('Guru Demo', 'guru@satu.id', crypt('gurusatu!', gen_salt('bf', 12)))
  returning id
), c as (
  insert into public.classrooms (teacher_id, name)
  select id, 'Kelas 1' from t
  returning teacher_id
)
insert into public.rewards (teacher_id, name, cost_points, stock)
select teacher_id, r.name, r.cost, r.stock
  from c,
       (values ('Stiker bintang', 30, null::int),
               ('Pensil warna',   100, 10),
               ('Buku gambar',    200, 5)) as r(name, cost, stock);

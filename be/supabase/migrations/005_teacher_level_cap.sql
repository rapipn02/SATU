-- Guru menetapkan batas level per anak. null = ikuti layanan AI.
-- Level <= batas terbuka untuk anak; level di atasnya terkunci walau AI menganggapnya terbuka.
alter table public.students
  add column max_level int check (max_level between 1 and 6);

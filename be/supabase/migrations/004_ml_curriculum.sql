-- =====================================================================
-- Kurikulum milik layanan ML (6 level, 98 item) + poin per item + data percobaan lengkap.
-- Jalankan di Supabase SQL Editor setelah 001, 002, 003.
--
-- PERHATIAN: migrasi ini MENGHAPUS data percobaan, PR, dan progres level lama,
-- karena id level dan id item berubah. Aman selama database baru berisi data demo.
-- Akun guru, kelas, anak, orang tua, dan hadiah TIDAK dihapus.
--
-- Blok "GENERATED" dibuat oleh `npm run sync:curriculum` dari GET {AI_URL}/kurikulum.
-- Jangan diedit manual; jalankan ulang skripnya kalau kurikulum ML berubah.
-- =====================================================================

delete from public.attempts;
delete from public.homework;          -- homework_items ikut terhapus
delete from public.level_progress;
delete from public.levels;

-- BEGIN GENERATED levels
insert into public.levels (id, category, order_no, title, items, unlock_after_level_id) values
  ('level-1', 'vokal', 1, 'Vokal a, i, u', '[{"id":"t1-a","text":"a","tingkat":1,"urutan":["a"],"bantuanVisual":true,"dinilaiSebagian":false},{"id":"t1-i","text":"i","tingkat":1,"urutan":["i"],"bantuanVisual":true,"dinilaiSebagian":false},{"id":"t1-u","text":"u","tingkat":1,"urutan":["u"],"bantuanVisual":true,"dinilaiSebagian":false},{"id":"t2-a","text":"a","tingkat":2,"urutan":["a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t2-i","text":"i","tingkat":2,"urutan":["i"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t2-u","text":"u","tingkat":2,"urutan":["u"],"bantuanVisual":false,"dinilaiSebagian":false}]'::jsonb, null),
  ('level-2', 'vokal', 2, 'Vokal e, o', '[{"id":"t1-o","text":"o","tingkat":1,"urutan":["o"],"bantuanVisual":true,"dinilaiSebagian":false},{"id":"t1-e","text":"e","tingkat":1,"urutan":["e"],"bantuanVisual":true,"dinilaiSebagian":false},{"id":"t2-o","text":"o","tingkat":2,"urutan":["o"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t2-e","text":"e","tingkat":2,"urutan":["e"],"bantuanVisual":false,"dinilaiSebagian":false}]'::jsonb, 'level-1'),
  ('level-3', 'konsonan', 3, 'Konsonan bibir: m/b/p dan f/v', '[{"id":"t1-M","text":"m","tingkat":1,"urutan":["M"],"bantuanVisual":true,"dinilaiSebagian":false},{"id":"t1-F","text":"f","tingkat":1,"urutan":["F"],"bantuanVisual":true,"dinilaiSebagian":false},{"id":"t2-M","text":"m","tingkat":2,"urutan":["M"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t2-F","text":"f","tingkat":2,"urutan":["F"],"bantuanVisual":false,"dinilaiSebagian":false}]'::jsonb, 'level-2'),
  ('level-4', 'konsonan', 4, 'Hembusan h, desis, dan huruf lidah', '[{"id":"t1-H","text":"h","tingkat":1,"urutan":["H"],"bantuanVisual":true,"dinilaiSebagian":false},{"id":"t1-S","text":"s","tingkat":1,"urutan":["S"],"bantuanVisual":true,"dinilaiSebagian":true},{"id":"t1-T","text":"t","tingkat":1,"urutan":["T"],"bantuanVisual":true,"dinilaiSebagian":true},{"id":"t2-H","text":"h","tingkat":2,"urutan":["H"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t2-S","text":"s","tingkat":2,"urutan":["S"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t2-T","text":"t","tingkat":2,"urutan":["T"],"bantuanVisual":false,"dinilaiSebagian":true}]'::jsonb, 'level-3'),
  ('level-5', 'suku_kata', 5, 'Suku kata', '[{"id":"t3-ma","text":"ma","tingkat":3,"urutan":["M","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-mi","text":"mi","tingkat":3,"urutan":["M","i"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-mu","text":"mu","tingkat":3,"urutan":["M","u"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-mo","text":"mo","tingkat":3,"urutan":["M","o"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-ba","text":"ba","tingkat":3,"urutan":["M","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-bi","text":"bi","tingkat":3,"urutan":["M","i"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-bu","text":"bu","tingkat":3,"urutan":["M","u"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-bo","text":"bo","tingkat":3,"urutan":["M","o"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-pa","text":"pa","tingkat":3,"urutan":["M","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-pi","text":"pi","tingkat":3,"urutan":["M","i"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-pu","text":"pu","tingkat":3,"urutan":["M","u"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-po","text":"po","tingkat":3,"urutan":["M","o"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-me","text":"me","tingkat":3,"urutan":["M","e"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-be","text":"be","tingkat":3,"urutan":["M","e"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-pe","text":"pe","tingkat":3,"urutan":["M","e"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-fa","text":"fa","tingkat":3,"urutan":["F","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-fi","text":"fi","tingkat":3,"urutan":["F","i"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-fu","text":"fu","tingkat":3,"urutan":["F","u"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-va","text":"va","tingkat":3,"urutan":["F","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-wa","text":"wa","tingkat":3,"urutan":["u","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-ya","text":"ya","tingkat":3,"urutan":["i","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-ha","text":"ha","tingkat":3,"urutan":["H","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-hi","text":"hi","tingkat":3,"urutan":["H","i"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-hu","text":"hu","tingkat":3,"urutan":["H","u"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-ho","text":"ho","tingkat":3,"urutan":["H","o"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t3-sa","text":"sa","tingkat":3,"urutan":["S","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-si","text":"si","tingkat":3,"urutan":["S","i"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-su","text":"su","tingkat":3,"urutan":["S","u"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-ca","text":"ca","tingkat":3,"urutan":["S","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-ja","text":"ja","tingkat":3,"urutan":["S","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-ta","text":"ta","tingkat":3,"urutan":["T","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-ti","text":"ti","tingkat":3,"urutan":["T","i"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-tu","text":"tu","tingkat":3,"urutan":["T","u"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-da","text":"da","tingkat":3,"urutan":["T","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-ka","text":"ka","tingkat":3,"urutan":["T","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-ki","text":"ki","tingkat":3,"urutan":["T","i"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-ku","text":"ku","tingkat":3,"urutan":["T","u"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-ga","text":"ga","tingkat":3,"urutan":["T","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-la","text":"la","tingkat":3,"urutan":["T","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-na","text":"na","tingkat":3,"urutan":["T","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t3-ra","text":"ra","tingkat":3,"urutan":["T","a"],"bantuanVisual":false,"dinilaiSebagian":true}]'::jsonb, 'level-4'),
  ('level-6', 'kata', 6, 'Kata', '[{"id":"t4-mama","text":"mama","tingkat":4,"urutan":["M","a","M","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-mami","text":"mami","tingkat":4,"urutan":["M","a","M","i"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-oma","text":"oma","tingkat":4,"urutan":["o","M","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-ayam","text":"ayam","tingkat":4,"urutan":["a","i","a","M"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-imam","text":"imam","tingkat":4,"urutan":["i","M","a","M"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-umum","text":"umum","tingkat":4,"urutan":["u","M","u","M"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-maaf","text":"maaf","tingkat":4,"urutan":["M","a","F"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-mau","text":"mau","tingkat":4,"urutan":["M","a","u"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-ayo","text":"ayo","tingkat":4,"urutan":["a","i","o"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-hiu","text":"hiu","tingkat":4,"urutan":["H","i","u"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-hama","text":"hama","tingkat":4,"urutan":["H","a","M","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-hawa","text":"hawa","tingkat":4,"urutan":["H","a","u","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-ayah","text":"ayah","tingkat":4,"urutan":["a","i","a","H"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-wahyu","text":"wahyu","tingkat":4,"urutan":["u","a","H","i","u"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-papa","text":"papa","tingkat":4,"urutan":["M","a","M","a"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-bola","text":"bola","tingkat":4,"urutan":["M","o","T","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-buku","text":"buku","tingkat":4,"urutan":["M","u","T","u"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-baju","text":"baju","tingkat":4,"urutan":["M","a","S","u"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-mata","text":"mata","tingkat":4,"urutan":["M","a","T","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-pipi","text":"pipi","tingkat":4,"urutan":["M","i","M","i"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-bibi","text":"bibi","tingkat":4,"urutan":["M","i","M","i"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-bumi","text":"bumi","tingkat":4,"urutan":["M","u","M","i"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-pita","text":"pita","tingkat":4,"urutan":["M","i","T","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-palu","text":"palu","tingkat":4,"urutan":["M","a","T","u"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-mobil","text":"mobil","tingkat":4,"urutan":["M","o","M","i","T"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-ibu","text":"ibu","tingkat":4,"urutan":["i","M","u"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-api","text":"api","tingkat":4,"urutan":["a","M","i"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-ubi","text":"ubi","tingkat":4,"urutan":["u","M","i"],"bantuanVisual":false,"dinilaiSebagian":false},{"id":"t4-topi","text":"topi","tingkat":4,"urutan":["T","o","M","i"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-sapu","text":"sapu","tingkat":4,"urutan":["S","a","M","u"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-kaki","text":"kaki","tingkat":4,"urutan":["T","a","T","i"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-kuda","text":"kuda","tingkat":4,"urutan":["T","u","T","a"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-roti","text":"roti","tingkat":4,"urutan":["T","o","T","i"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-dadu","text":"dadu","tingkat":4,"urutan":["T","a","T","u"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-susu","text":"susu","tingkat":4,"urutan":["S","u","S","u"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-gigi","text":"gigi","tingkat":4,"urutan":["T","i","T","i"],"bantuanVisual":false,"dinilaiSebagian":true},{"id":"t4-meja","text":"meja","tingkat":4,"urutan":["M","e","S","a"],"bantuanVisual":false,"dinilaiSebagian":true}]'::jsonb, 'level-5');
-- END GENERATED levels

-- ---------------------------------------------------------------------
-- Percobaan: simpan hasil lengkap dari penilai bibir (Mata)
-- ---------------------------------------------------------------------

alter table public.attempts
  add column success       boolean not null default false,  -- berhasil menahan semua langkah
  add column steps_reached int     not null default 0 check (steps_reached >= 0),
  add column duration_ms   int     check (duration_ms >= 0);
alter table public.attempts alter column success drop default;
-- attempts.score tetap dipakai: kemiripan bentuk bibir x 100.

-- ---------------------------------------------------------------------
-- Bintang terbaik per item (dasar poin: naik bintang x 10, mengulang tidak menambah)
-- ---------------------------------------------------------------------

create table public.item_progress (
  student_id uuid not null references public.students(id) on delete cascade,
  item_id    text not null,
  best_stars int  not null check (best_stars between 1 and 3),
  attempts   int  not null default 1 check (attempts >= 1),
  primary key (student_id, item_id)
);
alter table public.item_progress enable row level security;

-- ---------------------------------------------------------------------
-- record_attempt versi baru
--   - poin = kenaikan bintang terbaik ITEM x 10
--   - streak dan PR hanya dihitung dari percobaan yang BERHASIL (gagal tetap dapat 1 bintang)
-- ---------------------------------------------------------------------

drop function if exists public.record_attempt(uuid, text, text, numeric, int, text, uuid, int);

create or replace function public.record_attempt(
  p_student_id       uuid,
  p_level_id         text,
  p_item_id          text,
  p_success          boolean,
  p_steps            int,
  p_duration_ms      int,
  p_score            numeric,
  p_stars            int,
  p_source           text,
  p_homework_item_id uuid default null,
  p_min_daily        int  default 3
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_today       date := (now() at time zone 'Asia/Jakarta')::date;
  v_old_best    int;
  v_new_best    int;
  v_gain        int;
  v_points      int;
  v_level_best  int;
  v_count       int := null;
  v_streak      public.streaks;
  v_hw_item     public.homework_items;
  v_hw_done     boolean := false;
begin
  if p_stars not between 1 and 3 then
    raise exception 'INVALID_STARS' using errcode = '22023';
  end if;

  if p_homework_item_id is not null then
    select hi.* into v_hw_item
      from public.homework_items hi
      join public.homework h on h.id = hi.homework_id
     where hi.id = p_homework_item_id and h.student_id = p_student_id
     for update of hi;
    if not found then
      raise exception 'HOMEWORK_ITEM_NOT_FOUND' using errcode = 'P0002';
    end if;
    if v_hw_item.level_id <> p_level_id or v_hw_item.item <> p_item_id then
      raise exception 'HOMEWORK_ITEM_MISMATCH' using errcode = '22023';
    end if;
  end if;

  insert into public.attempts
    (student_id, level_id, item, score, stars, source, homework_item_id, success, steps_reached, duration_ms)
  values
    (p_student_id, p_level_id, p_item_id, p_score, p_stars, p_source, p_homework_item_id,
     p_success, p_steps, p_duration_ms);

  -- Poin dari bintang terbaik item
  select best_stars into v_old_best
    from public.item_progress
   where student_id = p_student_id and item_id = p_item_id
   for update;
  v_old_best := coalesce(v_old_best, 0);
  v_new_best := greatest(v_old_best, p_stars);
  v_gain := (v_new_best - v_old_best) * 10;

  insert into public.item_progress (student_id, item_id, best_stars)
  values (p_student_id, p_item_id, p_stars)
  on conflict (student_id, item_id) do update
     set best_stars = greatest(public.item_progress.best_stars, excluded.best_stars),
         attempts   = public.item_progress.attempts + 1;

  -- Progres level (dipakai aturan cadangan dan dashboard guru)
  insert into public.level_progress (student_id, level_id, best_stars, attempts, last_played_at)
  values (p_student_id, p_level_id, p_stars, 1, now())
  on conflict (student_id, level_id) do update
     set best_stars     = greatest(public.level_progress.best_stars, excluded.best_stars),
         attempts       = public.level_progress.attempts + 1,
         last_played_at = now()
  returning best_stars into v_level_best;

  update public.students
     set total_points = total_points + v_gain
   where id = p_student_id
  returning total_points into v_points;

  -- Streak: hanya percobaan yang berhasil
  if p_success then
    insert into public.daily_activity (student_id, day, practice_count)
    values (p_student_id, v_today, 1)
    on conflict (student_id, day) do update
       set practice_count = public.daily_activity.practice_count + 1
    returning practice_count into v_count;

    insert into public.streaks (student_id) values (p_student_id)
    on conflict (student_id) do nothing;

    if v_count = p_min_daily then
      update public.streaks
         set current = case
                         when last_active_day = v_today     then current
                         when last_active_day = v_today - 1 then current + 1
                         else 1
                       end,
             last_active_day = v_today
       where student_id = p_student_id;
      update public.streaks
         set longest = greatest(longest, current)
       where student_id = p_student_id;
    end if;
  end if;

  select * into v_streak from public.streaks where student_id = p_student_id;

  -- PR selesai hanya kalau percobaan berhasil dan bintang cukup
  if v_hw_item.id is not null and v_hw_item.completed_at is null
     and p_success and p_stars >= v_hw_item.required_stars then
    update public.homework_items set completed_at = now() where id = v_hw_item.id;
    if not exists (
      select 1 from public.homework_items
       where homework_id = v_hw_item.homework_id and completed_at is null
    ) then
      update public.homework
         set status = 'done', completed_at = now()
       where id = v_hw_item.homework_id;
      v_hw_done := true;
    end if;
  end if;

  return jsonb_build_object(
    'points_earned',    v_gain,
    'total_points',     v_points,
    'best_stars',       v_new_best,
    'level_best_stars', v_level_best,
    'daily_count',      coalesce(v_count, (select practice_count from public.daily_activity
                                            where student_id = p_student_id and day = v_today), 0),
    'streak_current',   coalesce(v_streak.current, 0),
    'streak_longest',   coalesce(v_streak.longest, 0),
    'homework_done',    v_hw_done
  );
end;
$$;

revoke execute on function public.record_attempt(uuid, text, text, boolean, int, int, numeric, int, text, uuid, int)
  from public, anon, authenticated;
grant execute on function public.record_attempt(uuid, text, text, boolean, int, int, numeric, int, text, uuid, int)
  to service_role;

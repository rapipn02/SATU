-- Poin per percobaan = bintang x 10 (sebelumnya: kenaikan bintang terbaik per item x 10).
-- Percobaan yang belum benar = 0 bintang = 0 poin dan tidak masuk bintang terbaik item.
-- Jalankan di SQL Editor Supabase (sekali). Fungsi record_attempt diganti, tabel tidak berubah.

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
  if p_stars not between 0 and 3 then
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

  -- Bintang terbaik item (untuk peta); poin dihitung dari bintang percobaan ini
  select best_stars into v_old_best
    from public.item_progress
   where student_id = p_student_id and item_id = p_item_id
   for update;
  v_old_best := coalesce(v_old_best, 0);
  v_new_best := greatest(v_old_best, p_stars);
  v_gain := p_stars * 10; -- 0 bintang 0 poin, 1 = 10, 2 = 20, 3 = 30

  -- item_progress hanya menyimpan bintang 1-3; percobaan 0 bintang tidak dicatat di sini
  if p_stars >= 1 then
  insert into public.item_progress (student_id, item_id, best_stars)
  values (p_student_id, p_item_id, p_stars)
  on conflict (student_id, item_id) do update
     set best_stars = greatest(public.item_progress.best_stars, excluded.best_stars),
         attempts   = public.item_progress.attempts + 1;
  end if;

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

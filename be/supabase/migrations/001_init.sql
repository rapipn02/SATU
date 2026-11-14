-- =====================================================================
-- SATU (Sahabat Tunarungu) — skema database
-- Jalankan di Supabase: Dashboard > SQL Editor > tempel > Run.
--
-- Supabase dipakai sebagai database saja. Semua akses lewat backend Express
-- dengan service role key. RLS dinyalakan tanpa policy, jadi anon key /
-- REST publik Supabase tidak bisa membaca atau menulis tabel mana pun.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Akun dan kelas
-- ---------------------------------------------------------------------

create table public.teachers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 1 and 100),
  email         text not null unique check (email = lower(email)),
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table public.classrooms (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  name       text not null check (length(name) between 1 and 100),
  created_at timestamptz not null default now()
);
create index classrooms_teacher_idx on public.classrooms(teacher_id);

create table public.students (
  id                    uuid primary key default gen_random_uuid(),
  classroom_id          uuid not null references public.classrooms(id) on delete cascade,
  nickname              text not null check (length(nickname) between 1 and 50),
  birth_date            date,
  photo_url             text,
  picture_password_hash text not null,          -- bcrypt dari "i-j-k" (3 indeks gambar 0..8)
  failed_logins         int  not null default 0 check (failed_logins >= 0),
  is_locked             boolean not null default false,
  total_points          int  not null default 0 check (total_points >= 0),
  calibration           jsonb,                   -- data kalibrasi wajah dari komponen ML (opsional)
  created_at            timestamptz not null default now()
);
create index students_classroom_idx on public.students(classroom_id);

-- Orang tua dibuat guru (nama saja), lalu mengaktifkan akun lewat link undangan.
create table public.parents (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 1 and 100),
  email         text unique check (email = lower(email)),  -- null sampai aktivasi
  password_hash text,                                      -- null sampai aktivasi
  invited_by    uuid references public.teachers(id) on delete set null,
  created_at    timestamptz not null default now(),
  activated_at  timestamptz,
  check ((activated_at is null) = (password_hash is null)),
  check ((activated_at is null) = (email is null))
);

create table public.parent_students (
  parent_id  uuid not null references public.parents(id)  on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  primary key (parent_id, student_id)
);
create index parent_students_student_idx on public.parent_students(student_id);

-- Token mentah hanya ada di link; database menyimpan hash SHA-256 (hex) dari token.
create table public.parent_invites (
  token_hash text primary key,
  parent_id  uuid not null references public.parents(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index parent_invites_parent_idx on public.parent_invites(parent_id);

-- ---------------------------------------------------------------------
-- Materi dan latihan
-- ---------------------------------------------------------------------

create table public.levels (
  id                    text primary key,       -- slug stabil, mis. 'vokal-1'
  category              text not null check (category in ('vokal', 'konsonan', 'suku_kata', 'kata')),
  order_no              int  not null,          -- urutan di peta petualangan (global)
  title                 text not null,
  items                 jsonb not null,         -- [{ "text": "a", "image": "url|null" }, ...]
  unlock_after_level_id text references public.levels(id),  -- terbuka jika level ini >= 1 bintang
  unique (order_no)
);

create table public.level_progress (
  student_id     uuid not null references public.students(id) on delete cascade,
  level_id       text not null references public.levels(id) on delete cascade,
  best_stars     int  not null default 0 check (best_stars between 0 and 3),
  attempts       int  not null default 0 check (attempts >= 0),
  last_played_at timestamptz,
  primary key (student_id, level_id)
);

create table public.homework (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  teacher_id   uuid references public.teachers(id) on delete set null,
  due_date     date not null,
  note         text,
  status       text not null default 'assigned' check (status in ('assigned', 'done')),
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index homework_student_due_idx on public.homework(student_id, due_date);

create table public.homework_items (
  id             uuid primary key default gen_random_uuid(),
  homework_id    uuid not null references public.homework(id) on delete cascade,
  position       int  not null,
  level_id       text not null references public.levels(id),
  item           text not null,
  required_stars int  not null default 1 check (required_stars between 1 and 3),
  completed_at   timestamptz
);
create index homework_items_homework_idx on public.homework_items(homework_id);

-- Satu percobaan yang dinilai di perangkat. Tidak ada video atau data per frame.
create table public.attempts (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  level_id         text not null references public.levels(id),
  item             text not null,
  score            numeric(5,2) check (score between 0 and 100),
  stars            int  not null check (stars between 0 and 3),
  source           text not null check (source in ('school', 'home')),
  homework_item_id uuid references public.homework_items(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index attempts_student_created_idx on public.attempts(student_id, created_at desc);

-- ---------------------------------------------------------------------
-- Streak, poin, hadiah, AI
-- ---------------------------------------------------------------------

-- Hitungan latihan lulus per hari (tanggal WIB).
create table public.daily_activity (
  student_id     uuid not null references public.students(id) on delete cascade,
  day            date not null,
  practice_count int  not null default 0 check (practice_count >= 0),
  primary key (student_id, day)
);

create table public.streaks (
  student_id      uuid primary key references public.students(id) on delete cascade,
  current         int  not null default 0 check (current >= 0),
  longest         int  not null default 0 check (longest >= 0),
  last_active_day date
);

create table public.rewards (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers(id) on delete cascade,
  name        text not null,
  image_url   text,
  cost_points int  not null check (cost_points > 0),
  stock       int  check (stock >= 0),          -- null = tidak terbatas
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index rewards_teacher_idx on public.rewards(teacher_id);

create table public.reward_redemptions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  reward_id    uuid not null references public.rewards(id) on delete cascade,
  points_spent int  not null check (points_spent > 0),
  status       text not null default 'requested' check (status in ('requested', 'given')),
  created_at   timestamptz not null default now(),
  given_at     timestamptz
);
create index reward_redemptions_student_idx on public.reward_redemptions(student_id);

-- Cache hasil layanan AI teman ML. student_id null = ringkasan satu kelas.
create table public.ai_insights (
  id           uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id   uuid references public.students(id) on delete cascade,
  summary      text not null,
  issues       jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);
create index ai_insights_lookup_idx on public.ai_insights(classroom_id, student_id, created_at desc);

-- ---------------------------------------------------------------------
-- Kunci akses publik: RLS aktif tanpa policy. Service role (backend) tetap bisa semua.
-- ---------------------------------------------------------------------

alter table public.teachers           enable row level security;
alter table public.classrooms         enable row level security;
alter table public.students           enable row level security;
alter table public.parents            enable row level security;
alter table public.parent_students    enable row level security;
alter table public.parent_invites     enable row level security;
alter table public.levels             enable row level security;
alter table public.level_progress     enable row level security;
alter table public.homework           enable row level security;
alter table public.homework_items     enable row level security;
alter table public.attempts           enable row level security;
alter table public.daily_activity     enable row level security;
alter table public.streaks            enable row level security;
alter table public.rewards            enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.ai_insights        enable row level security;

-- ---------------------------------------------------------------------
-- Fungsi atomik (dipanggil Express: supabase.rpc(...))
-- ---------------------------------------------------------------------

-- Catat satu percobaan dan perbarui progres, poin, streak, dan PR dalam satu transaksi.
-- Poin = kenaikan bintang terbaik x 10. Streak naik saat latihan lulus ke-N hari itu (WIB).
create or replace function public.record_attempt(
  p_student_id       uuid,
  p_level_id         text,
  p_item             text,
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
  v_today      date := (now() at time zone 'Asia/Jakarta')::date;
  v_old_best   int;
  v_gain       int;
  v_points     int;
  v_count      int := null;
  v_streak     public.streaks;
  v_hw_item    public.homework_items;
  v_hw_done    boolean := false;
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
    if v_hw_item.level_id <> p_level_id or v_hw_item.item <> p_item then
      raise exception 'HOMEWORK_ITEM_MISMATCH' using errcode = '22023';
    end if;
  end if;

  insert into public.attempts (student_id, level_id, item, score, stars, source, homework_item_id)
  values (p_student_id, p_level_id, p_item, p_score, p_stars, p_source, p_homework_item_id);

  -- Progres level dan poin
  select best_stars into v_old_best
    from public.level_progress
   where student_id = p_student_id and level_id = p_level_id
   for update;
  v_old_best := coalesce(v_old_best, 0);
  v_gain := greatest(p_stars - v_old_best, 0) * 10;

  insert into public.level_progress (student_id, level_id, best_stars, attempts, last_played_at)
  values (p_student_id, p_level_id, p_stars, 1, now())
  on conflict (student_id, level_id) do update
     set best_stars     = greatest(public.level_progress.best_stars, excluded.best_stars),
         attempts       = public.level_progress.attempts + 1,
         last_played_at = now();

  update public.students
     set total_points = total_points + v_gain
   where id = p_student_id
  returning total_points into v_points;

  -- Streak: hanya latihan lulus (>= 1 bintang) yang dihitung
  if p_stars >= 1 then
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

  -- PR
  if v_hw_item.id is not null and v_hw_item.completed_at is null
     and p_stars >= v_hw_item.required_stars then
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
    'points_earned',  v_gain,
    'total_points',   v_points,
    'best_stars',     greatest(v_old_best, p_stars),
    'daily_count',    coalesce(v_count, (select practice_count from public.daily_activity
                                          where student_id = p_student_id and day = v_today), 0),
    'streak_current', coalesce(v_streak.current, 0),
    'streak_longest', coalesce(v_streak.longest, 0),
    'homework_done',  v_hw_done
  );
end;
$$;

-- Tukar hadiah: poin dikurangi atomik, tidak bisa minus; hadiah harus milik guru kelas anak.
create or replace function public.redeem_reward(p_student_id uuid, p_reward_id uuid)
returns public.reward_redemptions
language plpgsql
set search_path = public
as $$
declare
  v_reward public.rewards;
  v_row    public.reward_redemptions;
begin
  select r.* into v_reward
    from public.rewards r
    join public.classrooms c on c.teacher_id = r.teacher_id
    join public.students   s on s.classroom_id = c.id
   where r.id = p_reward_id and r.active and s.id = p_student_id
   for update of r;
  if not found then
    raise exception 'REWARD_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_reward.stock is not null and v_reward.stock <= 0 then
    raise exception 'OUT_OF_STOCK' using errcode = 'P0001';
  end if;

  update public.students
     set total_points = total_points - v_reward.cost_points
   where id = p_student_id and total_points >= v_reward.cost_points;
  if not found then
    raise exception 'NOT_ENOUGH_POINTS' using errcode = 'P0001';
  end if;

  if v_reward.stock is not null then
    update public.rewards set stock = stock - 1 where id = p_reward_id;
  end if;

  insert into public.reward_redemptions (student_id, reward_id, points_spent)
  values (p_student_id, p_reward_id, v_reward.cost_points)
  returning * into v_row;
  return v_row;
end;
$$;

-- Fungsi hanya untuk backend (service role), bukan publik.
revoke execute on function public.record_attempt(uuid, text, text, numeric, int, text, uuid, int) from public, anon, authenticated;
revoke execute on function public.redeem_reward(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.record_attempt(uuid, text, text, numeric, int, text, uuid, int) to service_role;
grant  execute on function public.redeem_reward(uuid, uuid) to service_role;

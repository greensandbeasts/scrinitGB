/*
# Scrinit — Audience Intelligence for Screenplays (core schema)

Creates the full data model for Scrinit: a screenplay discovery platform that
measures audience engagement through real reader behaviour.

## New Tables
1. `profiles` — extends auth.users with role, display name, company, bio.
2. `screenplays` — creative assets; content stored as JSONB pages of typed lines.
3. `assignments` — links an anonymous reader to a screenplay.
4. `reading_sessions` — one row per reading session; progression + duration.
5. `reader_feedback` — required feedback after reading.
6. `industry_requests` — industry requests for a screenplay.

## Views
- `screenplay_discovery` — published screenplays + aggregated engagement stats
  (excludes script content).

## Ordering note
Tables are created first (no policies), then helper functions, then ALL RLS
policies last — so policies that call is_admin() compile successfully.
*/

-- ──────────────────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('writer', 'reader', 'industry', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type screenplay_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assignment_status as enum ('assigned', 'in_progress', 'completed', 'abandoned', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_status as enum ('in_progress', 'completed', 'abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type continue_decision as enum ('continue', 'stop');
exception when duplicate_object then null; end $$;

do $$ begin
  create type feedback_completion as enum ('completed', 'partially_read', 'stopped_early');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending', 'approved', 'declined', 'withdrawn');
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- profiles
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role user_role not null default 'writer',
  company text,
  bio text,
  avatar_color text default 'slate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ──────────────────────────────────────────────────────────────────────────
-- screenplays
-- content: JSONB array of pages. Each page = array of lines.
-- Each line = { "t": type, "x": text } where type is one of:
--   h = scene heading, a = action, c = character, d = dialogue,
--   p = parenthetical, t = transition
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.screenplays (
  id uuid primary key default gen_random_uuid(),
  writer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null,
  genre text not null,
  logline text not null,
  synopsis text,
  content jsonb not null default '[]'::jsonb,
  page_count int not null default 0,
  status screenplay_status not null default 'draft',
  cover_color text not null default 'amber',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.screenplays enable row level security;
create index if not exists idx_screenplays_writer on public.screenplays(writer_id);
create index if not exists idx_screenplays_status on public.screenplays(status);
create index if not exists idx_screenplays_genre on public.screenplays(genre);

-- ──────────────────────────────────────────────────────────────────────────
-- assignments
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  screenplay_id uuid not null references public.screenplays(id) on delete cascade,
  reader_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  status assignment_status not null default 'assigned',
  reader_number int,
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (screenplay_id, reader_id)
);

alter table public.assignments enable row level security;
create index if not exists idx_assignments_screenplay on public.assignments(screenplay_id);
create index if not exists idx_assignments_reader on public.assignments(reader_id);
create index if not exists idx_assignments_status on public.assignments(status);

-- ──────────────────────────────────────────────────────────────────────────
-- reading_sessions
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  screenplay_id uuid not null references public.screenplays(id) on delete cascade,
  reader_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  session_number int not null default 1,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_page_reached int not null default 1,
  pages_read_this_session int not null default 0,
  duration_seconds int not null default 0,
  status session_status not null default 'in_progress',
  decision continue_decision,
  checkpoint_page int
);

alter table public.reading_sessions enable row level security;
create index if not exists idx_sessions_screenplay on public.reading_sessions(screenplay_id);
create index if not exists idx_sessions_assignment on public.reading_sessions(assignment_id);
create index if not exists idx_sessions_reader on public.reading_sessions(reader_id);

-- ──────────────────────────────────────────────────────────────────────────
-- reader_feedback
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.reader_feedback (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  screenplay_id uuid not null references public.screenplays(id) on delete cascade,
  reader_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  would_recommend boolean not null,
  overall_rating int not null check (overall_rating between 1 and 10),
  story_rating int not null check (story_rating between 1 and 10),
  characters_rating int not null check (characters_rating between 1 and 10),
  pacing_rating int not null check (pacing_rating between 1 and 10),
  dialogue_rating int not null check (dialogue_rating between 1 and 10),
  written_feedback text not null default '',
  completion_status feedback_completion not null default 'completed',
  submitted_at timestamptz not null default now(),
  unique (assignment_id)
);

alter table public.reader_feedback enable row level security;
create index if not exists idx_feedback_screenplay on public.reader_feedback(screenplay_id);

-- ──────────────────────────────────────────────────────────────────────────
-- industry_requests
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.industry_requests (
  id uuid primary key default gen_random_uuid(),
  screenplay_id uuid not null references public.screenplays(id) on delete cascade,
  industry_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  writer_id uuid not null references public.profiles(id) on delete cascade,
  status request_status not null default 'pending',
  message text not null default '',
  company_snapshot text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (screenplay_id, industry_user_id)
);

alter table public.industry_requests enable row level security;
create index if not exists idx_requests_writer on public.industry_requests(writer_id);
create index if not exists idx_requests_industry on public.industry_requests(industry_user_id);
create index if not exists idx_requests_screenplay on public.industry_requests(screenplay_id);

-- ──────────────────────────────────────────────────────────────────────────
-- Helper functions (SECURITY DEFINER) — must exist BEFORE policies
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid();
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.user_role() to authenticated;

-- Auto-create a profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, company, bio, avatar_color)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'writer')::user_role,
    new.raw_user_meta_data->>'company',
    new.raw_user_meta_data->>'bio',
    coalesce(new.raw_user_meta_data->>'avatar_color', 'slate')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ──────────────────────────────────────────────────────────────────────────
-- RLS POLICIES (all after helper functions are defined)
-- ──────────────────────────────────────────────────────────────────────────

-- profiles
drop policy if exists "select_own_profile" on public.profiles;
create policy "select_own_profile" on public.profiles
  for select to authenticated using (auth.uid() = id or public.is_admin());

drop policy if exists "update_own_profile" on public.profiles;
create policy "update_own_profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id or public.is_admin());

-- screenplays
drop policy if exists "select_screenplays" on public.screenplays;
create policy "select_screenplays" on public.screenplays
  for select to authenticated using (
    writer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.assignments a
      where a.screenplay_id = screenplays.id and a.reader_id = auth.uid()
    )
    or exists (
      select 1 from public.industry_requests r
      where r.screenplay_id = screenplays.id
        and r.industry_user_id = auth.uid()
        and r.status = 'approved'
    )
  );

drop policy if exists "insert_own_screenplays" on public.screenplays;
create policy "insert_own_screenplays" on public.screenplays
  for insert to authenticated with check (writer_id = auth.uid() or public.is_admin());

drop policy if exists "update_own_screenplays" on public.screenplays;
create policy "update_own_screenplays" on public.screenplays
  for update to authenticated using (writer_id = auth.uid() or public.is_admin())
  with check (writer_id = auth.uid() or public.is_admin());

drop policy if exists "delete_own_screenplays" on public.screenplays;
create policy "delete_own_screenplays" on public.screenplays
  for delete to authenticated using (writer_id = auth.uid() or public.is_admin());

-- assignments
drop policy if exists "select_assignments" on public.assignments;
create policy "select_assignments" on public.assignments
  for select to authenticated using (
    reader_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.screenplays s
      where s.id = assignments.screenplay_id and s.writer_id = auth.uid()
    )
  );

drop policy if exists "insert_assignments" on public.assignments;
create policy "insert_assignments" on public.assignments
  for insert to authenticated with check (
    reader_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.screenplays s
      where s.id = assignments.screenplay_id and s.writer_id = auth.uid()
    )
  );

drop policy if exists "update_assignments" on public.assignments;
create policy "update_assignments" on public.assignments
  for update to authenticated using (
    reader_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.screenplays s
      where s.id = assignments.screenplay_id and s.writer_id = auth.uid()
    )
  )
  with check (
    reader_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.screenplays s
      where s.id = assignments.screenplay_id and s.writer_id = auth.uid()
    )
  );

drop policy if exists "delete_assignments" on public.assignments;
create policy "delete_assignments" on public.assignments
  for delete to authenticated using (
    public.is_admin()
    or exists (
      select 1 from public.screenplays s
      where s.id = assignments.screenplay_id and s.writer_id = auth.uid()
    )
  );

-- reading_sessions
drop policy if exists "select_reading_sessions" on public.reading_sessions;
create policy "select_reading_sessions" on public.reading_sessions
  for select to authenticated using (
    reader_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.screenplays s
      where s.id = reading_sessions.screenplay_id and s.writer_id = auth.uid()
    )
  );

drop policy if exists "insert_reading_sessions" on public.reading_sessions;
create policy "insert_reading_sessions" on public.reading_sessions
  for insert to authenticated with check (reader_id = auth.uid() or public.is_admin());

drop policy if exists "update_reading_sessions" on public.reading_sessions;
create policy "update_reading_sessions" on public.reading_sessions
  for update to authenticated using (reader_id = auth.uid() or public.is_admin())
  with check (reader_id = auth.uid() or public.is_admin());

drop policy if exists "delete_reading_sessions" on public.reading_sessions;
create policy "delete_reading_sessions" on public.reading_sessions
  for delete to authenticated using (reader_id = auth.uid() or public.is_admin());

-- reader_feedback
drop policy if exists "select_reader_feedback" on public.reader_feedback;
create policy "select_reader_feedback" on public.reader_feedback
  for select to authenticated using (
    reader_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.screenplays s
      where s.id = reader_feedback.screenplay_id and s.writer_id = auth.uid()
    )
  );

drop policy if exists "insert_reader_feedback" on public.reader_feedback;
create policy "insert_reader_feedback" on public.reader_feedback
  for insert to authenticated with check (reader_id = auth.uid() or public.is_admin());

drop policy if exists "update_reader_feedback" on public.reader_feedback;
create policy "update_reader_feedback" on public.reader_feedback
  for update to authenticated using (reader_id = auth.uid() or public.is_admin())
  with check (reader_id = auth.uid() or public.is_admin());

drop policy if exists "delete_reader_feedback" on public.reader_feedback;
create policy "delete_reader_feedback" on public.reader_feedback
  for delete to authenticated using (reader_id = auth.uid() or public.is_admin());

-- industry_requests
drop policy if exists "select_industry_requests" on public.industry_requests;
create policy "select_industry_requests" on public.industry_requests
  for select to authenticated using (
    industry_user_id = auth.uid()
    or writer_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "insert_industry_requests" on public.industry_requests;
create policy "insert_industry_requests" on public.industry_requests
  for insert to authenticated with check (industry_user_id = auth.uid() or public.is_admin());

drop policy if exists "update_industry_requests" on public.industry_requests;
create policy "update_industry_requests" on public.industry_requests
  for update to authenticated using (
    industry_user_id = auth.uid()
    or writer_id = auth.uid()
    or public.is_admin()
  )
  with check (
    industry_user_id = auth.uid()
    or writer_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "delete_industry_requests" on public.industry_requests;
create policy "delete_industry_requests" on public.industry_requests
  for delete to authenticated using (
    industry_user_id = auth.uid()
    or public.is_admin()
  );

-- ──────────────────────────────────────────────────────────────────────────
-- screenplay_discovery view (metadata + aggregate stats, NO content)
-- ──────────────────────────────────────────────────────────────────────────
create or replace view public.screenplay_discovery as
with agg as (
  select
    s.id as screenplay_id,
    count(distinct a.id) as total_assignments,
    count(distinct case when a.status in ('completed','abandoned') then a.id end) as responded_assignments,
    count(distinct case when a.status = 'completed' then a.id end) as completed_assignments,
    count(distinct case when a.status = 'abandoned' then a.id end) as abandoned_assignments,
    count(distinct a.reader_id) as reader_count,
    count(distinct f.id) as feedback_count,
    count(distinct case when f.would_recommend then f.id end) as recommend_count,
    coalesce(avg(f.overall_rating), 0) as avg_rating,
    coalesce(avg(f.story_rating), 0) as avg_story,
    coalesce(avg(f.characters_rating), 0) as avg_characters,
    coalesce(avg(f.pacing_rating), 0) as avg_pacing,
    coalesce(avg(f.dialogue_rating), 0) as avg_dialogue,
    coalesce(avg(sess.last_page_reached), 0) as avg_last_page,
    count(distinct sess.id) as total_sessions,
    count(distinct case when sess.session_number > 1 then sess.id end) as return_sessions
  from public.screenplays s
  left join public.assignments a on a.screenplay_id = s.id
  left join public.reader_feedback f on f.screenplay_id = s.id
  left join public.reading_sessions sess on sess.screenplay_id = s.id
  group by s.id
)
select
  s.id,
  s.title,
  s.genre,
  s.logline,
  s.synopsis,
  s.writer_id,
  p.display_name as writer_name,
  p.company as writer_company,
  s.cover_color,
  s.tags,
  s.page_count,
  s.published_at,
  coalesce(agg.total_assignments, 0) as total_assignments,
  coalesce(agg.reader_count, 0) as reader_count,
  coalesce(agg.completed_assignments, 0) as completed_count,
  coalesce(agg.abandoned_assignments, 0) as abandoned_count,
  coalesce(agg.feedback_count, 0) as feedback_count,
  coalesce(agg.recommend_count, 0) as recommend_count,
  case when coalesce(agg.reader_count,0) = 0 then 0
       else round(agg.completed_assignments::numeric / agg.reader_count * 100, 1) end as completion_rate,
  case when coalesce(agg.feedback_count,0) = 0 then 0
       else round(agg.recommend_count::numeric / agg.feedback_count * 100, 1) end as recommend_rate,
  round(coalesce(agg.avg_rating,0), 1) as avg_rating,
  round(coalesce(agg.avg_story,0), 1) as avg_story,
  round(coalesce(agg.avg_characters,0), 1) as avg_characters,
  round(coalesce(agg.avg_pacing,0), 1) as avg_pacing,
  round(coalesce(agg.avg_dialogue,0), 1) as avg_dialogue,
  round(coalesce(agg.avg_last_page,0), 1) as avg_last_page,
  coalesce(agg.total_sessions, 0) as total_sessions,
  coalesce(agg.return_sessions, 0) as return_sessions,
  case when coalesce(agg.total_sessions,0) = 0 then 0
       else round(agg.return_sessions::numeric / agg.total_sessions * 100, 1) end as return_rate,
  least(round(coalesce(agg.reader_count,0)::numeric / 10 * 100), 100)::int as confidence_score
from public.screenplays s
join public.profiles p on p.id = s.writer_id
left join agg on agg.screenplay_id = s.id
where s.status = 'published';

grant select on public.screenplay_discovery to authenticated;

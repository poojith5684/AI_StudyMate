-- Run once in Supabase Dashboard > SQL Editor.
-- The table stores code drafts and accepted status per signed-in user/course/problem.
create table if not exists public.coding_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null default '',
  problem_id text not null,
  language text not null default 'c' check (language in ('c', 'python', 'java', 'sql')),
  difficulty text not null default 'Easy' check (difficulty in ('Easy', 'Medium', 'Hard')),
  code text not null default '',
  solved boolean not null default false,
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, problem_id)
);

alter table public.coding_progress enable row level security;

drop policy if exists "Users can read own coding progress" on public.coding_progress;
create policy "Users can read own coding progress"
  on public.coding_progress for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own coding progress" on public.coding_progress;
create policy "Users can insert own coding progress"
  on public.coding_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own coding progress" on public.coding_progress;
create policy "Users can update own coding progress"
  on public.coding_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.coding_progress to authenticated;

create index if not exists coding_progress_user_course_idx
  on public.coding_progress (user_id, course_id, updated_at desc);

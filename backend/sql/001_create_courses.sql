-- Safe to apply to a project that does not yet have a courses table.
-- Existing course records are not dropped or modified.
create table if not exists public.courses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    title text not null,
    description text,
    subject text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists courses_user_created_at_idx
    on public.courses (user_id, created_at desc);

alter table public.courses enable row level security;

grant select, insert, update, delete on public.courses to authenticated, service_role;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'courses'
          and policyname = 'Users manage their own courses'
    ) then
        create policy "Users manage their own courses"
            on public.courses
            for all
            to authenticated
            using ((select auth.uid()) = user_id)
            with check ((select auth.uid()) = user_id);
    end if;
end
$$;

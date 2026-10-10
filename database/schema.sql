-- SQLEducation — PostgreSQL schema for Supabase
-- Initial schema for the first database milestone.
-- Run once in Supabase SQL Editor against a NEW project/database.
--
-- Architecture notes:
-- - Authentication credentials stay in Supabase Auth (auth.users); public.users is the profile table.
-- - The Express backend will perform privileged writes and validate lesson access.
-- - Never expose the Supabase service-role key in browser code.
-- - Exercise evaluation settings are admin-only so answer keys are not leaked to students.

begin;

-- ---------------------------------------------------------------------------
-- 1. USERS / PROFILES
-- ---------------------------------------------------------------------------
create table public.users (
    id uuid primary key references auth.users (id) on delete cascade,
    username text not null unique
        check (username = lower(username) and length(username) between 3 and 30),
    display_name text not null check (length(trim(display_name)) between 1 and 80),
    role text not null default 'student'
        check (role in ('student', 'admin')),
    avatar_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.users is
    'Public profile for a Supabase Auth user. Passwords are managed by Supabase Auth, never stored here.';

-- ---------------------------------------------------------------------------
-- 2. COURSES
-- ---------------------------------------------------------------------------
create table public.courses (
    id bigint generated always as identity primary key,
    title text not null check (length(trim(title)) between 1 and 160),
    slug text not null unique,
    description text not null default '',
    is_published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. LESSONS
-- ---------------------------------------------------------------------------
create table public.lessons (
    id bigint generated always as identity primary key,
    course_id bigint not null references public.courses (id) on delete cascade,
    title text not null check (length(trim(title)) between 1 and 160),
    slug text not null,
    summary text not null default '',
    content text not null default '',
    order_index integer not null check (order_index > 0),
    is_published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint lessons_course_slug_unique unique (course_id, slug),
    constraint lessons_course_order_unique unique (course_id, order_index)
);

-- ---------------------------------------------------------------------------
-- 4. MANUAL, PER-USER LESSON ACCESS
-- ---------------------------------------------------------------------------
create table public.user_lesson_access (
    user_id uuid not null references public.users (id) on delete cascade,
    lesson_id bigint not null references public.lessons (id) on delete cascade,
    unlocked_by uuid not null references public.users (id) on delete restrict,
    unlocked_at timestamptz not null default now(),
    primary key (user_id, lesson_id)
);

comment on table public.user_lesson_access is
    'One row per user and lesson manually unlocked by an administrator. Completion never unlocks a lesson automatically.';

-- ---------------------------------------------------------------------------
-- 5. LESSON PROGRESS
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
    user_id uuid not null references public.users (id) on delete cascade,
    lesson_id bigint not null references public.lessons (id) on delete cascade,
    status text not null default 'not_started'
        check (status in ('not_started', 'in_progress', 'completed')),
    started_at timestamptz,
    completed_at timestamptz,
    updated_at timestamptz not null default now(),
    primary key (user_id, lesson_id),
    constraint lesson_progress_completion_consistent check (
        (status = 'completed' and completed_at is not null)
        or (status <> 'completed' and completed_at is null)
    )
);

-- ---------------------------------------------------------------------------
-- 6. EXERCISES
-- ---------------------------------------------------------------------------
create table public.exercises (
    id bigint generated always as identity primary key,
    lesson_id bigint not null references public.lessons (id) on delete cascade,
    title text not null check (length(trim(title)) between 1 and 160),
    statement text not null,
    exercise_type text not null
        check (exercise_type in ('class', 'homework', 'daily')),
    difficulty smallint not null default 1 check (difficulty between 1 and 5),
    starter_code text not null default '',
    -- Keep validator/answer settings private: students must not read this table directly.
    validation_config jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    created_by uuid references public.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column public.exercises.validation_config is
    'Private server-side evaluation configuration. Never return this field to a student client.';

-- ---------------------------------------------------------------------------
-- 7. DAILY CHALLENGES — one assigned exercise per user per calendar date
-- ---------------------------------------------------------------------------
create table public.daily_challenges (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.users (id) on delete cascade,
    challenge_date date not null,
    exercise_id bigint not null references public.exercises (id) on delete restrict,
    difficulty_at_assignment smallint not null check (difficulty_at_assignment between 1 and 5),
    status text not null default 'assigned'
        check (status in ('assigned', 'in_progress', 'completed')),
    assigned_at timestamptz not null default now(),
    completed_at timestamptz,
    constraint daily_challenges_one_per_user_per_day unique (user_id, challenge_date),
    -- Composite key allows submissions to enforce that the challenge, user and exercise match.
    constraint daily_challenges_id_user_exercise_unique unique (id, user_id, exercise_id),
    constraint daily_challenges_completion_consistent check (
        (status = 'completed' and completed_at is not null)
        or (status <> 'completed' and completed_at is null)
    )
);

-- ---------------------------------------------------------------------------
-- 8. SUBMISSIONS / ATTEMPTS
-- ---------------------------------------------------------------------------
create table public.submissions (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.users (id) on delete cascade,
    exercise_id bigint not null references public.exercises (id) on delete restrict,
    daily_challenge_id bigint,
    sql_code text not null,
    is_correct boolean,
    score numeric(5,2) check (score between 0 and 100),
    feedback text,
    execution_time_ms integer check (execution_time_ms is null or execution_time_ms >= 0),
    submitted_at timestamptz not null default now(),
    constraint submissions_challenge_matches_user_exercise
        foreign key (daily_challenge_id, user_id, exercise_id)
        references public.daily_challenges (id, user_id, exercise_id)
        on delete set null (daily_challenge_id)
);

comment on table public.submissions is
    'Append-only record of student attempts. The backend evaluates SQL and writes correctness/score; clients must not set those fields directly.';

-- ---------------------------------------------------------------------------
-- 9. STREAK SUMMARY
-- ---------------------------------------------------------------------------
create table public.streaks (
    user_id uuid primary key references public.users (id) on delete cascade,
    current_streak integer not null default 0 check (current_streak >= 0),
    longest_streak integer not null default 0 check (longest_streak >= current_streak),
    last_activity_date date,
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10. DAILY ACTIVITY — one qualifying activity marker per user and date
-- ---------------------------------------------------------------------------
create table public.daily_activity (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.users (id) on delete cascade,
    activity_date date not null,
    activity_type text not null
        check (activity_type in ('daily_challenge_completed', 'exercise_correct', 'lesson_completed')),
    recorded_at timestamptz not null default now(),
    constraint daily_activity_one_per_user_per_day unique (user_id, activity_date)
);

comment on table public.daily_activity is
    'One row per user and date when at least one qualifying learning activity occurred. Written by the backend, not the browser.';

-- ---------------------------------------------------------------------------
-- 11. PUBLIC STUDENT PROJECTS
-- ---------------------------------------------------------------------------
create table public.projects (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.users (id) on delete cascade,
    title text not null check (length(trim(title)) between 1 and 160),
    description text not null default '',
    project_url text
        check (project_url is null or project_url ~* '^https?://'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 12. COMMENTS AND OPTIONAL REPLIES
-- ---------------------------------------------------------------------------
create table public.comments (
    id bigint generated always as identity primary key,
    project_id bigint not null references public.projects (id) on delete cascade,
    user_id uuid not null references public.users (id) on delete cascade,
    parent_comment_id bigint references public.comments (id) on delete cascade,
    content text not null check (length(trim(content)) between 1 and 5000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
create index lessons_course_id_idx on public.lessons (course_id);
create index user_lesson_access_lesson_id_idx on public.user_lesson_access (lesson_id);
create index lesson_progress_lesson_id_idx on public.lesson_progress (lesson_id);
create index exercises_lesson_difficulty_idx on public.exercises (lesson_id, difficulty) where is_active;
create index daily_challenges_date_idx on public.daily_challenges (challenge_date);
create index submissions_user_submitted_idx on public.submissions (user_id, submitted_at desc);
create index submissions_exercise_id_idx on public.submissions (exercise_id);
create index daily_activity_user_date_idx on public.daily_activity (user_id, activity_date desc);
create index projects_created_at_idx on public.projects (created_at desc);
create index projects_user_id_idx on public.projects (user_id);
create index comments_project_created_idx on public.comments (project_id, created_at);
create index comments_parent_comment_id_idx on public.comments (parent_comment_id);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- The Express backend will use the service-role key only on the server and will
-- still enforce business permissions. These policies also protect direct
-- Supabase client access. Do not put the service-role key in the frontend.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.users u
        where u.id = (select auth.uid())
          and u.role = 'admin'
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.users enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.user_lesson_access enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.exercises enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.submissions enable row level security;
alter table public.streaks enable row level security;
alter table public.daily_activity enable row level security;
alter table public.projects enable row level security;
alter table public.comments enable row level security;

-- Profiles: users may see/update their own student profile; only admins can manage roles.
create policy users_select_self_or_admin on public.users
for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

create policy users_insert_own_student_profile on public.users
for insert to authenticated
with check (id = (select auth.uid()) and role = 'student');

create policy users_update_own_student_profile on public.users
for update to authenticated
using (id = (select auth.uid()) and role = 'student')
with check (id = (select auth.uid()) and role = 'student');

create policy users_admin_all on public.users
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Published courses can be listed. All course management is admin-only.
create policy courses_select_published on public.courses
for select to anon, authenticated
using (is_published or (select public.is_admin()));

create policy courses_admin_all on public.courses
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Students can directly read only lessons that are published and unlocked for them.
create policy lessons_select_unlocked on public.lessons
for select to authenticated
using (
    (select public.is_admin())
    or (
        is_published
        and exists (
            select 1
            from public.user_lesson_access ula
            where ula.user_id = (select auth.uid())
              and ula.lesson_id = lessons.id
        )
    )
);

create policy lessons_admin_all on public.lessons
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Access grants can be read by the student they belong to; only admins manage them.
create policy lesson_access_select_self_or_admin on public.user_lesson_access
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy lesson_access_admin_all on public.user_lesson_access
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Progress belongs to the student; access must have been granted before progress is created.
create policy lesson_progress_select_self_or_admin on public.lesson_progress
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy lesson_progress_insert_own_unlocked on public.lesson_progress
for insert to authenticated
with check (
    user_id = (select auth.uid())
    and exists (
        select 1 from public.user_lesson_access ula
        where ula.user_id = (select auth.uid())
          and ula.lesson_id = lesson_progress.lesson_id
    )
);

create policy lesson_progress_update_own_unlocked on public.lesson_progress
for update to authenticated
using (
    user_id = (select auth.uid())
    and exists (
        select 1 from public.user_lesson_access ula
        where ula.user_id = (select auth.uid())
          and ula.lesson_id = lesson_progress.lesson_id
    )
)
with check (
    user_id = (select auth.uid())
    and exists (
        select 1 from public.user_lesson_access ula
        where ula.user_id = (select auth.uid())
          and ula.lesson_id = lesson_progress.lesson_id
    )
);

create policy lesson_progress_admin_all on public.lesson_progress
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Exercise rows include private evaluation settings, so students cannot query this table directly.
-- The backend must return only safe exercise fields after checking lesson access.
create policy exercises_admin_all on public.exercises
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Daily challenge assignments are private to the assigned student and admins.
create policy daily_challenges_select_self_or_admin on public.daily_challenges
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy daily_challenges_admin_all on public.daily_challenges
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Attempts and scoring are server-controlled; students may only read their own attempts.
create policy submissions_select_self_or_admin on public.submissions
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy submissions_admin_all on public.submissions
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy streaks_select_self_or_admin on public.streaks
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy streaks_admin_all on public.streaks
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy daily_activity_select_self_or_admin on public.daily_activity
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy daily_activity_admin_all on public.daily_activity
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Projects and comments are public to read; authenticated users can manage their own content.
create policy projects_public_read on public.projects
for select to anon, authenticated
using (true);

create policy projects_insert_own on public.projects
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy projects_update_own on public.projects
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy projects_delete_own on public.projects
for delete to authenticated
using (user_id = (select auth.uid()));

create policy projects_admin_all on public.projects
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy comments_public_read on public.comments
for select to anon, authenticated
using (true);

create policy comments_insert_own on public.comments
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy comments_update_own on public.comments
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy comments_delete_own on public.comments
for delete to authenticated
using (user_id = (select auth.uid()));

create policy comments_admin_all on public.comments
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Explicit grants for the tables intended to be accessed by the browser.
-- Sensitive learning/evaluation tables are accessed through the Express backend.
grant select on public.users, public.courses, public.lessons,
    public.user_lesson_access, public.lesson_progress,
    public.daily_challenges, public.submissions, public.streaks,
    public.daily_activity to authenticated;

grant insert, update on public.users to authenticated;
grant insert, update on public.lesson_progress to authenticated;
grant select on public.courses to anon;
grant select on public.projects, public.comments to anon, authenticated;
grant insert, update, delete on public.projects, public.comments to authenticated;
grant usage, select on sequence public.projects_id_seq, public.comments_id_seq to authenticated;

commit;

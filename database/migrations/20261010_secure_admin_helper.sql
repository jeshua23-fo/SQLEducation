-- Keep the SECURITY DEFINER helper outside Supabase's exposed public schema.
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

alter function public.is_admin() set schema private;

revoke all on function private.is_admin() from public;
revoke all on function private.is_admin() from anon;
grant execute on function private.is_admin() to authenticated;

-- Cover foreign keys reported by Supabase's performance advisor.
create index if not exists comments_user_id_idx on public.comments (user_id);
create index if not exists daily_challenges_exercise_id_idx on public.daily_challenges (exercise_id);
create index if not exists exercises_created_by_idx on public.exercises (created_by);
create index if not exists submissions_challenge_user_exercise_idx
  on public.submissions (daily_challenge_id, user_id, exercise_id);
create index if not exists user_lesson_access_unlocked_by_idx
  on public.user_lesson_access (unlocked_by);

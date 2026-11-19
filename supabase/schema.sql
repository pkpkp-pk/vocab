-- Run once in the Supabase SQL Editor for this project.
-- Supabase Auth stores registered accounts in auth.users; this table stores sessions.
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id text not null default '',
  topic_title text not null,
  topic_prompt text not null default '',
  topic_category text not null default '',
  topic_difficulty text not null default '',
  transcript text not null default '',
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create index if not exists practice_sessions_user_created_idx
  on public.practice_sessions (user_id, created_at desc);

alter table public.practice_sessions enable row level security;

drop policy if exists "Users can read their own practice sessions" on public.practice_sessions;
create policy "Users can read their own practice sessions"
  on public.practice_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can save their own practice sessions" on public.practice_sessions;
create policy "Users can save their own practice sessions"
  on public.practice_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own practice sessions" on public.practice_sessions;
create policy "Users can delete their own practice sessions"
  on public.practice_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.practice_sessions to authenticated;

-- Keep per-user Gemini usage bounded without exposing the counter table.
create table if not exists public.ai_coaching_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 1 check (request_count between 1 and 5),
  primary key (user_id, usage_date)
);

alter table public.ai_coaching_usage enable row level security;
revoke all on public.ai_coaching_usage from anon, authenticated;

-- A shared sequence keeps model selection alternating across function instances
-- and across users. The function advances it only for allowed requests.
create table if not exists public.ai_coaching_rotation (
  id boolean primary key default true check (id),
  sequence_number bigint not null default 0 check (sequence_number >= 0)
);

insert into public.ai_coaching_rotation (id, sequence_number)
values (true, 0)
on conflict (id) do nothing;

alter table public.ai_coaching_rotation enable row level security;
revoke all on public.ai_coaching_rotation from anon, authenticated;

drop function if exists public.claim_ai_coaching_request();
create function public.claim_ai_coaching_request()
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requesting_user uuid := (select auth.uid());
  new_count integer;
  next_rotation bigint;
begin
  if requesting_user is null then
    return 0;
  end if;

  insert into public.ai_coaching_usage (user_id, usage_date, request_count)
  values (requesting_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = public.ai_coaching_usage.request_count + 1
    where public.ai_coaching_usage.request_count < 5
  returning request_count into new_count;

  if new_count is null then
    return 0;
  end if;

  update public.ai_coaching_rotation
    set sequence_number = sequence_number + 1
    where id = true
    returning sequence_number into next_rotation;

  return next_rotation;
end;
$function$;

revoke all on function public.claim_ai_coaching_request() from public, anon;
grant execute on function public.claim_ai_coaching_request() to authenticated;

-- Keep short-lived live-transcription token issuance bounded per account.
create table if not exists public.gemini_transcription_token_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 1 check (request_count between 1 and 20),
  primary key (user_id, usage_date)
);

alter table public.gemini_transcription_token_usage enable row level security;
revoke all on public.gemini_transcription_token_usage from anon, authenticated;

drop function if exists public.claim_gemini_transcription_token();
create function public.claim_gemini_transcription_token()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requesting_user uuid := (select auth.uid());
  new_count integer;
begin
  if requesting_user is null then
    return false;
  end if;

  insert into public.gemini_transcription_token_usage (user_id, usage_date, request_count)
  values (requesting_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = public.gemini_transcription_token_usage.request_count + 1
    where public.gemini_transcription_token_usage.request_count < 20
  returning request_count into new_count;

  return new_count is not null;
end;
$function$;

revoke all on function public.claim_gemini_transcription_token() from public, anon;
grant execute on function public.claim_gemini_transcription_token() to authenticated;

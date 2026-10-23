-- Persist per-user HotGPT preferences in Supabase without changing existing chat or wallet tables.
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light')),
  response_style text not null default 'professional' check (response_style in ('professional','concise','friendly','detailed')),
  custom_instructions text not null default '' check (char_length(custom_instructions) <= 2000),
  language text not null default 'ar' check (language in ('ar','en')),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from anon, authenticated;
grant all on public.user_preferences to service_role;

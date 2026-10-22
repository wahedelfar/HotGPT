-- Admin credentials are only accessed by server-side service-role requests.
create table if not exists public.admin_credentials (
  email text primary key check (email = lower(trim(email))),
  password_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.admin_credentials enable row level security;
revoke all on table public.admin_credentials from anon, authenticated;
grant all on table public.admin_credentials to service_role;

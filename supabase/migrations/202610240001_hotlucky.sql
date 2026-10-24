-- HotLucky: fixed-value digital product plus a separate complimentary bonus.
-- Apply only after reviewing the target Supabase project and existing wallet schema.
create table if not exists public.hotlucky_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  payment_method text not null check (payment_method in ('vodafone_cash','paypal')),
  amount_minor integer not null,
  currency text not null check (currency in ('EGP','USD')),
  base_tokens integer not null default 100 check (base_tokens = 100),
  proof_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  prize_code text unique,
  prize_key text,
  prize_label text,
  reward_issued boolean not null default false,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  spun_at timestamptz,
  reward_issued_at timestamptz
);
create index if not exists hotlucky_orders_user_id_idx on public.hotlucky_orders(user_id);
create index if not exists hotlucky_orders_status_created_idx on public.hotlucky_orders(status, created_at desc);
alter table public.hotlucky_orders enable row level security;
-- No client policies: all order/payment/proof/reward mutations are server-only.
create table if not exists public.hotlucky_daily_gifts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.hotlucky_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prize_key text not null,
  prize_label text not null,
  prize_code text not null unique,
  issued_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.hotlucky_daily_gifts enable row level security;

-- HotGPT: Supabase Auth, wallet, manual payment review, and cloud chat persistence.
-- Applied to Supabase project ujtvgdaslpevoaraweid on 2026-10-21.
-- This migration is retained in the test branch for reproducibility.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  free_answers_used integer not null default 0 check (free_answers_used >= 0),
  token_balance integer not null default 0 check (token_balance >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  payment_method text not null check (payment_method in ('vodafone_cash','paypal')),
  package_tokens integer not null check (package_tokens in (500,800,1000)),
  amount_egp integer not null check ((package_tokens=500 and amount_egp=300) or (package_tokens=800 and amount_egp=500) or (package_tokens=1000 and amount_egp=700)),
  transfer_reference text,
  proof_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'محادثة جديدة',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists payment_requests_status_created_idx on public.payment_requests(status, created_at desc);
create index if not exists payment_requests_user_created_idx on public.payment_requests(user_id, created_at desc);
create index if not exists conversations_user_updated_idx on public.conversations(user_id, updated_at desc);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.payment_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.profiles, public.wallets, public.payment_requests, public.conversations, public.messages from anon, authenticated;
grant all on public.profiles, public.wallets, public.payment_requests, public.conversations, public.messages to service_role;

create or replace function public.hotgpt_handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id,email,display_name)
  values(new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict (id) do update set email=excluded.email;
  insert into public.wallets(user_id) values(new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.hotgpt_handle_new_user() from public, anon, authenticated, service_role;
drop trigger if exists hotgpt_auth_user_created on auth.users;
create trigger hotgpt_auth_user_created after insert on auth.users for each row execute function public.hotgpt_handle_new_user();

create or replace function public.hotgpt_consume_answer_credit(p_user_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare changed integer;
begin
  update public.wallets set free_answers_used=free_answers_used+1, updated_at=now()
  where user_id=p_user_id and free_answers_used<2;
  get diagnostics changed = row_count;
  if changed=1 then return 'free'; end if;
  update public.wallets set token_balance=token_balance-1, updated_at=now()
  where user_id=p_user_id and token_balance>0;
  get diagnostics changed = row_count;
  if changed=1 then return 'paid'; end if;
  return null;
end;
$$;
revoke all on function public.hotgpt_consume_answer_credit(uuid) from public, anon, authenticated;
grant execute on function public.hotgpt_consume_answer_credit(uuid) to service_role;

create or replace function public.hotgpt_refund_answer_credit(p_user_id uuid, p_kind text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if p_kind='free' then
    update public.wallets set free_answers_used=greatest(0,free_answers_used-1), updated_at=now() where user_id=p_user_id;
  elsif p_kind='paid' then
    update public.wallets set token_balance=token_balance+1, updated_at=now() where user_id=p_user_id;
  else return false;
  end if;
  return found;
end;
$$;
revoke all on function public.hotgpt_refund_answer_credit(uuid,text) from public, anon, authenticated;
grant execute on function public.hotgpt_refund_answer_credit(uuid,text) to service_role;

create or replace function public.hotgpt_review_payment(p_payment_id uuid, p_approve boolean, p_reviewer text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare payment_row public.payment_requests%rowtype;
begin
  select * into payment_row from public.payment_requests where id=p_payment_id for update;
  if not found then raise exception 'payment_not_found'; end if;
  if payment_row.status <> 'pending' then raise exception 'payment_already_reviewed'; end if;
  update public.payment_requests set status=case when p_approve then 'approved' else 'rejected' end, reviewed_at=now(), reviewed_by=p_reviewer where id=p_payment_id;
  if p_approve then update public.wallets set token_balance=token_balance+payment_row.package_tokens, updated_at=now() where user_id=payment_row.user_id; end if;
  return jsonb_build_object('id',payment_row.id,'status',case when p_approve then 'approved' else 'rejected' end);
end;
$$;
revoke all on function public.hotgpt_review_payment(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.hotgpt_review_payment(uuid,boolean,text) to service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('hotgpt-payment-proofs','hotgpt-payment-proofs',false,1200000,array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

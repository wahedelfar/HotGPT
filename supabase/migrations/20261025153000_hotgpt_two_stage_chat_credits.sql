-- HotGPT two-stage chat credits.
-- The existing wallet column is token_balance; application-facing terminology is user_credits.
alter table public.messages
  add column if not exists part_count integer not null default 1 check (part_count >= 1),
  add column if not exists is_complete boolean not null default true,
  add column if not exists last_finish_reason text;

create table if not exists public.chat_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  part_index integer not null check (part_index >= 1),
  amount integer not null check (amount > 0),
  entry_type text not null check (entry_type in ('charge','refund')),
  created_at timestamptz not null default now(),
  unique (message_id, part_index, entry_type)
);
create index if not exists chat_credit_ledger_user_created_idx
  on public.chat_credit_ledger(user_id, created_at desc);

create or replace function public.hotgpt_charge_chat_part(
  p_user_id uuid, p_message_id uuid, p_part_index integer, p_cost integer default 5
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_balance integer;
begin
  if p_cost <> 5 or p_part_index < 1 then raise exception 'invalid_chat_charge'; end if;
  perform 1 from public.messages where id=p_message_id and user_id=p_user_id for update;
  if not found then raise exception 'message_not_found'; end if;
  if exists(select 1 from public.chat_credit_ledger where message_id=p_message_id and part_index=p_part_index and entry_type='charge') then
    select token_balance into v_balance from public.wallets where user_id=p_user_id;
    return jsonb_build_object('charged',false,'duplicate',true,'user_credits',coalesce(v_balance,0));
  end if;
  update public.wallets set token_balance=token_balance-p_cost, updated_at=now()
    where user_id=p_user_id and token_balance>=p_cost returning token_balance into v_balance;
  if not found then
    select token_balance into v_balance from public.wallets where user_id=p_user_id;
    return jsonb_build_object('charged',false,'insufficient',true,'user_credits',coalesce(v_balance,0));
  end if;
  insert into public.chat_credit_ledger(user_id,message_id,part_index,amount,entry_type)
    values(p_user_id,p_message_id,p_part_index,p_cost,'charge');
  return jsonb_build_object('charged',true,'duplicate',false,'user_credits',v_balance);
end; $$;

create or replace function public.hotgpt_refund_chat_part(
  p_user_id uuid, p_message_id uuid, p_part_index integer, p_cost integer default 5
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_balance integer; v_refund_inserted boolean := false;
begin
  if p_cost <> 5 or p_part_index < 1 then raise exception 'invalid_chat_refund'; end if;
  if not exists(select 1 from public.chat_credit_ledger where user_id=p_user_id and message_id=p_message_id and part_index=p_part_index and entry_type='charge') then raise exception 'charge_not_found'; end if;
  insert into public.chat_credit_ledger(user_id,message_id,part_index,amount,entry_type)
    values(p_user_id,p_message_id,p_part_index,p_cost,'refund')
    on conflict(message_id,part_index,entry_type) do nothing;
  v_refund_inserted := found;
  if v_refund_inserted then
    update public.wallets set token_balance=token_balance+p_cost, updated_at=now() where user_id=p_user_id returning token_balance into v_balance;
  else
    select token_balance into v_balance from public.wallets where user_id=p_user_id;
  end if;
  return jsonb_build_object('refunded',v_refund_inserted,'user_credits',coalesce(v_balance,0));
end; $$;

revoke all on function public.hotgpt_charge_chat_part(uuid,uuid,integer,integer) from public, anon, authenticated;
revoke all on function public.hotgpt_refund_chat_part(uuid,uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.hotgpt_charge_chat_part(uuid,uuid,integer,integer) to service_role;
grant execute on function public.hotgpt_refund_chat_part(uuid,uuid,integer,integer) to service_role;

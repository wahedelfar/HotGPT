-- Free-token exhaustion and HotLucky server-issued one-time token codes.
alter table public.hotlucky_orders
  add column if not exists token_code_used boolean not null default false;

create or replace function public.hotlucky_approve_order(p_order_id uuid, p_admin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.hotlucky_orders%rowtype;
  prior_approved integer;
  roll numeric;
  amount integer;
  pkey text;
  plabel text;
  pcode text;
begin
  select * into o from public.hotlucky_orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status <> 'pending' then raise exception 'already_processed'; end if;

  select count(*) into prior_approved
    from public.hotlucky_orders
   where user_id = o.user_id and status = 'approved' and id <> o.id;

  if prior_approved = 0 then
    -- The 100-token base grant is available exactly once per member.
    update public.wallets
       set token_balance = coalesce(token_balance, 0) + 100
     where user_id = o.user_id;
    if not found then raise exception 'wallet_not_found'; end if;
    pkey := 'base_tokens_100';
    plabel := '100 توكن أساسي';
    pcode := null;
  else
    -- Weighted, server-side token code: 70% 10, 20% 25, 7% 50, 3% 100.
    roll := random() * 100;
    if roll < 70 then amount := 10;
    elsif roll < 90 then amount := 25;
    elsif roll < 97 then amount := 50;
    else amount := 100;
    end if;
    pkey := 'tokens_' || amount::text;
    plabel := 'مبروك! كسبت ' || amount::text || ' توكن';
    pcode := 'HOT-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 6));
  end if;

  update public.hotlucky_orders
     set status = 'approved',
         reviewed_at = now(),
         reviewed_by = p_admin,
         prize_code = pcode,
         prize_key = pkey,
         prize_label = plabel,
         spun_at = case when pcode is null then now() else null end,
         token_code_used = false,
         reward_issued = false
   where id = p_order_id
   returning * into o;

  if pcode is not null then
    insert into public.hotlucky_daily_gifts(order_id, user_id, prize_key, prize_label, prize_code)
    values (o.id, o.user_id, pkey, plabel, pcode);
  end if;

  return jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'email', o.email,
    'base_tokens_awarded', (prior_approved = 0),
    'token_reward', case when prior_approved = 0 then 100 else amount end,
    'prize_key', pkey,
    'prize_label', plabel,
    'prize_code', pcode,
    'token_code_used', false
  );
end;
$$;

create or replace function public.hotlucky_redeem_token_code(p_user_id uuid, p_email text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.hotlucky_orders%rowtype;
  amount integer;
begin
  select * into o
    from public.hotlucky_orders
   where user_id = p_user_id
     and lower(email) = lower(p_email)
     and status = 'approved'
     and prize_code = upper(trim(p_code))
     and prize_key in ('tokens_10','tokens_25','tokens_50','tokens_100')
   for update;
  if not found then raise exception 'token_code_not_found'; end if;
  if o.token_code_used or o.reward_issued then raise exception 'token_code_used'; end if;

  amount := case o.prize_key
    when 'tokens_10' then 10 when 'tokens_25' then 25
    when 'tokens_50' then 50 when 'tokens_100' then 100 else 0 end;
  if amount = 0 then raise exception 'invalid_token_amount'; end if;

  update public.wallets
     set token_balance = coalesce(token_balance, 0) + amount
   where user_id = p_user_id;
  if not found then raise exception 'wallet_not_found'; end if;

  update public.hotlucky_orders
     set token_code_used = true, reward_issued = true, reward_issued_at = now()
   where id = o.id;

  update public.hotlucky_daily_gifts set issued_at = now() where order_id = o.id;

  return jsonb_build_object('success', true, 'tokens', amount, 'used', true, 'email', o.email);
end;
$$;

revoke all on function public.hotlucky_redeem_token_code(uuid,text,text) from public, anon, authenticated;
grant execute on function public.hotlucky_redeem_token_code(uuid,text,text) to service_role;

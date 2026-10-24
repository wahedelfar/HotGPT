-- Assign the guaranteed promotional gift at payment approval so admins can see it immediately.
-- The member reveal action only reveals the already-persisted gift; it never rolls a second time.
create or replace function public.hotlucky_approve_order(p_order_id uuid, p_admin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.hotlucky_orders%rowtype;
  roll numeric;
  pkey text;
  plabel text;
  pcode text;
begin
  select * into o from public.hotlucky_orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status <> 'pending' then raise exception 'already_processed'; end if;

  -- Product delivery is part of the same transaction as payment approval.
  update public.wallets
     set token_balance = coalesce(token_balance, 0) + 100
   where user_id = o.user_id;
  if not found then raise exception 'wallet_not_found'; end if;

  roll := random() * 100;
  if roll < 40 then pkey := 'tokens_50'; plabel := '50 توكن إضافي';
  elsif roll < 65 then pkey := 'tokens_100'; plabel := '100 توكن إضافي';
  elsif roll < 80 then pkey := 'tokens_200'; plabel := '200 توكن إضافي';
  elsif roll < 90 then pkey := 'pro_7'; plabel := 'Pro لمدة 7 أيام';
  elsif roll < 95 then pkey := 'pro_30'; plabel := 'Pro لمدة 30 يومًا';
  elsif roll < 98 then pkey := 'tokens_500'; plabel := '500 توكن إضافي';
  elsif roll < 99.5 then pkey := 'ultra_30'; plabel := 'Ultra لمدة 30 يومًا';
  else pkey := 'tokens_1000_ultra'; plabel := '1000 توكن + Ultra';
  end if;

  pcode := 'HOT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  update public.hotlucky_orders
     set status = 'approved',
         reviewed_at = now(),
         reviewed_by = p_admin,
         prize_code = pcode,
         prize_key = pkey,
         prize_label = plabel
   where id = p_order_id
   returning * into o;

  insert into public.hotlucky_daily_gifts(order_id, user_id, prize_key, prize_label, prize_code)
  values (o.id, o.user_id, pkey, plabel, pcode);

  return jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'email', o.email,
    'prize_key', pkey,
    'prize_label', plabel,
    'prize_code', pcode
  );
end;
$$;

create or replace function public.hotlucky_spin(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.hotlucky_orders%rowtype;
  g public.hotlucky_daily_gifts%rowtype;
begin
  select * into o
    from public.hotlucky_orders
   where user_id = p_user_id
     and status = 'approved'
     and spun_at is null
   order by reviewed_at asc
   limit 1
   for update;
  if not found then raise exception 'spin_not_available'; end if;

  select * into g from public.hotlucky_daily_gifts where order_id = o.id for update;
  if not found then raise exception 'gift_not_found'; end if;

  update public.hotlucky_orders set spun_at = now() where id = o.id;
  return jsonb_build_object(
    'order_id', o.id,
    'prize_key', g.prize_key,
    'prize_label', g.prize_label,
    'prize_code', g.prize_code
  );
end;
$$;

revoke all on function public.hotlucky_approve_order(uuid,text) from public, anon, authenticated;
revoke all on function public.hotlucky_spin(uuid) from public, anon, authenticated;

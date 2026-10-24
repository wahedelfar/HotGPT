create or replace function public.hotlucky_award_tokens(p_order_id uuid, p_admin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare o public.hotlucky_orders%rowtype; amount integer;
begin
  select * into o from public.hotlucky_orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status <> 'approved' or o.prize_key is null then raise exception 'reward_not_ready'; end if;
  if o.reward_issued then raise exception 'already_processed'; end if;
  amount := case o.prize_key when 'tokens_50' then 50 when 'tokens_100' then 100 when 'tokens_200' then 200 when 'tokens_500' then 500 when 'tokens_1000_ultra' then 1000 else 0 end;
  if amount = 0 then raise exception 'subscription_reward_requires_subscription_integration'; end if;
  update public.wallets set token_balance = coalesce(token_balance,0) + amount where user_id = o.user_id;
  if not found then raise exception 'wallet_not_found'; end if;
  update public.hotlucky_orders set reward_issued = true, reward_issued_at = now(), reviewed_by = coalesce(reviewed_by,'') where id = p_order_id;
  update public.hotlucky_daily_gifts set issued_at = now() where order_id = p_order_id;
  return jsonb_build_object('success',true,'tokens',amount,'email',o.email);
end;
$$;
revoke all on function public.hotlucky_award_tokens(uuid,text) from public, anon, authenticated;

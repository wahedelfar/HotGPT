alter table public.hotlucky_orders add column if not exists consolation_awarded boolean not null default false;
alter table public.hotlucky_orders add column if not exists consolation_awarded_at timestamptz;

create or replace function public.hotlucky_award_consolation(p_order_id uuid, p_admin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare o public.hotlucky_orders%rowtype;
begin
  select * into o from public.hotlucky_orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status <> 'approved' then raise exception 'order_not_approved'; end if;
  if o.consolation_awarded then raise exception 'already_processed'; end if;
  update public.wallets set token_balance = coalesce(token_balance,0) + 10 where user_id = o.user_id;
  if not found then raise exception 'wallet_not_found'; end if;
  update public.hotlucky_orders set consolation_awarded = true, consolation_awarded_at = now() where id = p_order_id;
  return jsonb_build_object('success',true,'tokens',10,'email',o.email);
end;
$$;
revoke all on function public.hotlucky_award_consolation(uuid,text) from public, anon, authenticated;
grant execute on function public.hotlucky_award_consolation(uuid,text) to service_role;

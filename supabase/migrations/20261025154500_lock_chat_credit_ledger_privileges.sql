-- Keep the financial ledger server-only. RPCs remain service_role-only.
alter table public.chat_credit_ledger enable row level security;
revoke all privileges on table public.chat_credit_ledger from public, anon, authenticated;

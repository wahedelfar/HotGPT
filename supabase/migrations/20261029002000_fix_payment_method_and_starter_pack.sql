-- HotGPT: align payment constraints with the current application configuration.
-- Safe to re-run: every constraint is dropped/recreated by name.
-- Scope: local manual payments, PayPal audit rows, and HotLucky local payments.

alter table if exists public.payment_requests
  drop constraint if exists payment_requests_payment_method_check,
  drop constraint if exists payment_requests_package_tokens_check,
  drop constraint if exists payment_requests_amount_egp_check;

alter table if exists public.payment_requests
  add constraint payment_requests_payment_method_check
    check (payment_method in ('vodafone_cash', 'instapay', 'paypal')),
  add constraint payment_requests_package_tokens_check
    check (package_tokens in (100, 500, 800, 1000)),
  add constraint payment_requests_amount_egp_check
    check (
      (payment_method = 'paypal' and amount_egp = 0)
      or (package_tokens = 100 and amount_egp = 100)
      or (package_tokens = 500 and amount_egp = 300)
      or (package_tokens = 800 and amount_egp = 500)
      or (package_tokens = 1000 and amount_egp = 700)
    );

alter table if exists public.hotlucky_orders
  drop constraint if exists hotlucky_orders_payment_method_check;

alter table if exists public.hotlucky_orders
  add constraint hotlucky_orders_payment_method_check
    check (payment_method in ('vodafone_cash', 'instapay', 'paypal'));

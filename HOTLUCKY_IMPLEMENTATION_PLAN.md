# HotLucky implementation

- Isolated feature routes under `/api/lucky` and `/api/admin/lucky`.
- Lucky page route `/lucky.php` is handled by the current React router.
- Vodafone Cash participation costs 100 EGP.
- PayPal remains disabled until `HOTLUCKY_PAYPAL_URL` is configured.
- Admin-only proof access and review.
- Weighted prizes must be issued server-side and idempotently.

This file is a planning note only; no payment or prize feature is active until schema migration and tests are completed.

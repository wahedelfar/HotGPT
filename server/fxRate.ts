/**
 * USD/EGP rate for PayPal pricing (server-only).
 *
 * Product rule (2026-10-26): token packs are priced in EGP for the Arab
 * audience; PayPal charges the USD *equivalent at today's rate* — computed
 * live, never hardcoded, because the rate moves. The USD amount is rounded
 * UP to the next whole dollar so a pack never sells below its EGP price,
 * and the merchant can pin his own rate with PAYPAL_USD_EGP_RATE.
 */
let cached: { rate: number; at: number } | null = null;
const TTL_MS = 60 * 60 * 1000; // 1 hour
const FALLBACK_RATE = 55; // last-resort if every source is unreachable

async function fetchRate(): Promise<number> {
  // Free, keyless sources; first sane answer wins.
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    const j = await r.json().catch(() => null) as any;
    const rate = Number(j?.rates?.EGP);
    if (rate > 10 && rate < 200) return rate;
  } catch {}
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=EGP", { cache: "no-store" });
    const j = await r.json().catch(() => null) as any;
    const rate = Number(j?.rates?.EGP);
    if (rate > 10 && rate < 200) return rate;
  } catch {}
  return FALLBACK_RATE;
}

export async function getUsdEgpRate(): Promise<number> {
  const pinned = Number(process.env.PAYPAL_USD_EGP_RATE || "");
  if (pinned > 10 && pinned < 200) return pinned;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.rate;
  const rate = await fetchRate();
  cached = { rate, at: Date.now() };
  return rate;
}

/** Whole-dollar USD price for an EGP amount at today's rate (rounded up). */
export async function usdForEgp(egp: number): Promise<{ usd: number; rate: number }> {
  const rate = await getUsdEgpRate();
  return { usd: Math.max(1, Math.ceil(egp / rate)), rate };
}

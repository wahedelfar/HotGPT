export default function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
  return res.status(200).json({
    vodafoneCashNumber: "01063537686",
    paypalPaymentUrl: process.env.PAYPAL_PAYMENT_URL ?? "",
    packages: [{ tokens: 500, priceEgp: 300 }, { tokens: 800, priceEgp: 500 }, { tokens: 1000, priceEgp: 700 }],
    freeAnswers: 2,
    creditsPerAnswer: 1,
  });
}

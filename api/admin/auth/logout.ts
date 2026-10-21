import { clearAdminCookie } from "../../../server/_core/adminSession.js";
export default function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  res.setHeader("Set-Cookie", clearAdminCookie());
  return res.status(200).json({ success: true });
}

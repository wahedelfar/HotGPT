import { readAdminSession } from "../../../server/_core/adminSession.js";
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
  const session = await readAdminSession(req);
  return res.status(session ? 200 : 401).json(session ? { authenticated: true, email: session.email } : { authenticated: false });
}

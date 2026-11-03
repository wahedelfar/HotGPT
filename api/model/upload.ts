import { ensureReverseBucket, recordReverseUpload, RE_BUCKET, RE_MAX_BYTES } from "../../server/reverseLab.ts";

const supabaseUrl = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const publicKey = () => process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  const token = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
  const url = supabaseUrl(), key = publicKey(), secret = serviceKey();
  if (!token) return res.status(401).json({ error: "login_required" });
  if (!url || !key || !secret) return res.status(503).json({ error: "supabase_server_not_configured" });
  try {
    const authResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!authResponse.ok) return res.status(authResponse.status === 401 || authResponse.status === 403 ? 401 : 503).json({ error: authResponse.status === 401 || authResponse.status === 403 ? "login_required" : "auth_unavailable" });
    const user = await authResponse.json() as { id?: string };
    if (!user.id) return res.status(401).json({ error: "login_required" });
    // Reverse Lab branch (2026-11-03): binaries up to 50MB into the
    // dedicated hotgpt-re-uploads bucket. No extension/MIME gating —
    // real tools ship as .exe/.dll/.apk/extension-less ELF alike; the
    // file's magic is validated by the analysis handler before any debit.
    // Every slot is registered for the 3-day auto-delete sweep.
    if ((req.body ?? {}).kind === "reverse") {
      const rName = typeof req.body.name === "string" ? req.body.name.trim() : "";
      const rSize = Number(req.body.size);
      if (!rName || rName.length > 160 || !Number.isFinite(rSize) || rSize < 1) return res.status(400).json({ error: "unsupported_attachment" });
      if (rSize > RE_MAX_BYTES) return res.status(413).json({ error: "file_too_large" });
      await ensureReverseBucket();
      const rPath = `${user.id}/${crypto.randomUUID()}.bin`;
      const rSigned = await fetch(`${url}/storage/v1/object/upload/sign/${RE_BUCKET}/${rPath}`, {
        method: "POST", headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json" },
        body: JSON.stringify({ upsert: false }), cache: "no-store",
      });
      const rPayload = await rSigned.json().catch(() => ({})) as { signedURL?: string; url?: string; error?: string; message?: string };
      if (!rSigned.ok || !(rPayload.signedURL || rPayload.url)) {
        console.error("[Upload] Reverse signed URL failed", rSigned.status, rPayload.error || rPayload.message || "unknown");
        return res.status(502).json({ error: "upload_unavailable" });
      }
      const rSignedUrl = rPayload.signedURL || rPayload.url!;
      const rUploadUrl = rSignedUrl.startsWith("http") ? rSignedUrl : `${url}/storage/v1${rSignedUrl.startsWith("/") ? "" : "/"}${rSignedUrl}`;
      await recordReverseUpload(user.id, rPath, rName, rSize);
      return res.status(200).json({ uploadUrl: rUploadUrl, path: rPath, contentType: "application/octet-stream", maxBytes: RE_MAX_BYTES });
    }
    const body = req.body ?? {}, name = typeof body.name === "string" ? body.name : "", size = Number(body.size), type = typeof body.type === "string" ? body.type : "";
    const match = name.toLowerCase().match(/\.(pdf|txt|md|csv|json)$/);
    const allowedTypes: Record<string, string[]> = { pdf:["application/pdf"], txt:["text/plain"], md:["text/markdown","text/plain"], csv:["text/csv","application/vnd.ms-excel","text/plain"], json:["application/json","text/json","text/plain"] };
    if (!match || !Number.isFinite(size) || size < 1) return res.status(400).json({ error: "unsupported_attachment" });
    if (size > 10 * 1024 * 1024) return res.status(413).json({ error: "file_too_large" });
    if (type && !allowedTypes[match[1]].includes(type)) return res.status(400).json({ error: "unsupported_attachment" });
    const contentType: Record<string, string> = { pdf: "application/pdf", txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json" };
    const path = `${user.id}/${crypto.randomUUID()}.${match[1]}`;
    const signedResponse = await fetch(`${url}/storage/v1/object/upload/sign/hotgpt-uploads/${path}`, {
      method: "POST", headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ upsert: false }), cache: "no-store",
    });
    const payload = await signedResponse.json().catch(() => ({})) as { signedURL?: string; url?: string; error?: string; message?: string };
    if (!signedResponse.ok || !(payload.signedURL || payload.url)) {
      console.error("[Upload] Signed URL failed", signedResponse.status, payload.error || payload.message || "unknown");
      return res.status(502).json({ error: "upload_unavailable" });
    }
    const signed = payload.signedURL || payload.url!;
    const uploadUrl = signed.startsWith("http") ? signed : `${url}/storage/v1${signed.startsWith("/") ? "" : "/"}${signed}`;
    return res.status(200).json({ uploadUrl, path, contentType: contentType[match[1]] });
  } catch (error) {
    console.error("[Upload] Signed upload failed", error instanceof Error ? error.message : "unknown");
    return res.status(502).json({ error: "upload_unavailable" });
  }
}

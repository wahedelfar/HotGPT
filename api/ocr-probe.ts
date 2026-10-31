// THROWAWAY preview-gate probe (branch ocr-preview-gate only — never merge).
// Proves tesseract.js bundles and runs on Vercel: creates a worker with the
// default language-data CDN, OCRs one posted image, returns text + timing.
import { createWorker } from "tesseract.js";

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  const started = Date.now();
  try {
    const imageBase64 = String((req.body ?? {}).imageBase64 || "");
    if (!imageBase64) return res.status(400).json({ error: "imageBase64_required" });
    const bytes = Buffer.from(imageBase64, "base64");
    const worker = await createWorker(["ara", "eng"], 1, { cachePath: "/tmp" });
    const { data } = await worker.recognize(bytes);
    await worker.terminate();
    return res.status(200).json({ ok: true, ms: Date.now() - started, text: data.text.slice(0, 2000) });
  } catch (error) {
    return res.status(500).json({ ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message : "unknown" });
  }
}

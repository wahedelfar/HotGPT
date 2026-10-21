import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getProviderStatus, requestProviderCompletion } from "./modelProvider";

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "100kb", extended: true }));
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", app: "nexachat" })
  );
  app.get("/api/platform/config.js", (_req, res) => {
    res
      .set("Cache-Control", "no-store")
      .type("application/javascript")
      .send(publicPlatformScript());
  });
  app.get("/api/model/status", (_req, res) => {
    const status = getProviderStatus();
    res.json({ configured: status.configured, model: status.model });
  });
  const chatRateLimits = new Map<string, { count: number; resetAt: number }>();
  app.post("/api/model/chat", async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const rate = chatRateLimits.get(ip);
    if (rate && rate.resetAt > now && rate.count >= 20) {
      return res.status(429).json({ error: "rate_limited" });
    }
    if (!rate || rate.resetAt <= now) {
      chatRateLimits.set(ip, { count: 1, resetAt: now + 60_000 });
    } else {
      rate.count += 1;
    }
    if (chatRateLimits.size > 5000) {
      for (const [key, value] of chatRateLimits) {
        if (value.resetAt <= now) chatRateLimits.delete(key);
      }
    }

    const { messages, extended } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages_required" });
    }
    const validMessages =
      messages.length <= 40 &&
      messages.every((message: unknown) =>
        Boolean(message) &&
        typeof message === "object" &&
        ["user", "assistant"].includes((message as { role?: string }).role ?? "") &&
        typeof (message as { content?: unknown }).content === "string" &&
        (message as { content: string }).content.trim().length > 0 &&
        (message as { content: string }).content.length <= 20_000
      );
    const totalCharacters = messages.reduce(
      (total: number, message: { content: string }) => total + message.content.length,
      0
    );
    if (!validMessages || totalCharacters > 80_000 || (extended !== undefined && typeof extended !== "boolean")) {
      return res.status(400).json({ error: "invalid_messages" });
    }
    try {
      const content = await requestProviderCompletion(messages, extended === true);
      return res.json({ content });
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderNotConfigured") {
        return res.status(503).json({ error: "provider_not_configured" });
      }
      if (error instanceof Error && error.name === "ProviderTimeout") {
        return res.status(504).json({ error: "provider_timeout" });
      }
      console.error("[Model] Provider request failed", error instanceof Error ? error.name : "unknown");
      return res.status(502).json({ error: "provider_request_failed" });
    }
  });
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );
  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);
  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () =>
    console.log(`Server listening on port ${port}`)
  );
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});

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
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
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
  app.post("/api/model/chat", async (req, res) => {
    const { messages, extended } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: "messages_required" });
    try {
      const content = await requestProviderCompletion(
        messages,
        Boolean(extended)
      );
      return res.json({ content });
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderNotConfigured")
        return res.status(503).json({ error: "provider_not_configured" });
      console.error("[Model] Provider request failed", error);
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

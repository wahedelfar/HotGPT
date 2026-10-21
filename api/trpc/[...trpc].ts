import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

const middleware: any = createExpressMiddleware({ router: appRouter, createContext });

export default function handler(req: any, res: any) {
  const route = req.query?.trpc;
  const parts = Array.isArray(route) ? route : typeof route === "string" ? [route] : [];
  req.url = "/" + parts.join("/");
  req.originalUrl = "/api/trpc" + req.url;
  req.path = req.url.split("?")[0];
  req.get = req.get ?? ((name: string) => req.headers?.[name.toLowerCase()]);
  req.protocol = req.protocol ?? (req.headers?.["x-forwarded-proto"] === "https" ? "https" : "http");
  return middleware(req, res);
}

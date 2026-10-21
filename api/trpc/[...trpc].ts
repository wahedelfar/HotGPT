import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

const middleware = createExpressMiddleware({ router: appRouter, createContext });

export default function handler(req: any, res: any) {
  const route = req.query?.trpc;
  const parts = Array.isArray(route) ? route : typeof route === "string" ? [route] : [];
  req.url = "/" + parts.join("/");
  req.originalUrl = req.url;
  return middleware(req, res);
}

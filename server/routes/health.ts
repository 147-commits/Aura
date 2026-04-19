import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ ok: true, version: "2.1.0" });
});

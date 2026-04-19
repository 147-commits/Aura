/**
 * Routes barrel. Mounts every domain router under /api.
 *
 * Consumers:
 *   server/index.ts → app.use(buildRouter())
 *
 * Adding a new domain:
 *   1. Create server/routes/<domain>.ts exporting a Router
 *   2. Import it here
 *   3. Mount it in buildRouter()
 */

import { Router } from "express";
import { healthRouter } from "./health";
import { chatRouter } from "./chat";
import { memoryRouter } from "./memory";
import { tasksRouter } from "./tasks";
import { messagesRouter } from "./messages";
import { craftsRouter } from "./crafts";
import { builderRouter } from "./builder";
import { uploadsRouter } from "./uploads";
import { mcpRouter } from "./mcp";
import { skillsRouter } from "./skills";

export function buildRouter(): Router {
  const r = Router();
  r.use("/api", healthRouter);
  r.use("/api", chatRouter);
  r.use("/api", memoryRouter);
  r.use("/api", tasksRouter);
  r.use("/api", messagesRouter);
  r.use("/api", craftsRouter);
  r.use("/api", builderRouter);
  r.use("/api", uploadsRouter);
  r.use("/api", mcpRouter);
  r.use("/api", skillsRouter);
  return r;
}

import templatesRouter from "./routes/templates.js";
import { requireTemplate, serializeTemplateWrites } from "./middleware/template-scope.js";
import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import companiesRouter from "./routes/companies.js";
import briefingRouter from "./routes/briefing.js";
import variablesRouter from "./routes/variables.js";
import templateRouter from "./routes/template.js";
import rulesRouter from "./routes/rules.js";
import settingsRouter from "./routes/settings.js";
import configurationsRouter from "./routes/configurations.js";
import logsRouter from "./routes/logs.js";

dotenv.config();

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoints
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const workflowPath = "/api/companies/:companyId/templates/:templateId";
  app.use(workflowPath, requireTemplate, serializeTemplateWrites, briefingRouter, variablesRouter, templateRouter, rulesRouter, logsRouter);
  app.use("/api/companies/:companyId/templates", templatesRouter);
  app.use("/api/companies", configurationsRouter);
  app.use("/api/companies", companiesRouter);
  app.use("/api/settings", settingsRouter);

  return app;
}

export default createApp;

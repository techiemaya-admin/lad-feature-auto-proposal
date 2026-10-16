import templatesRouter from "./routes/templates.js";
import { requireTemplate, serializeTemplateWrites } from "./middleware/template-scope.js";
import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import companiesRouter from "./routes/companies.js";
import briefingRouter from "./routes/briefing.js";
import variablesRouter from "./routes/variables.js";
import templateRouter from "./routes/template.js";
import rulesRouter from "./routes/rules.js";
import proposalRouter from "./routes/proposal.js";
import settingsRouter from "./routes/settings.js";
import configurationsRouter from "./routes/configurations.js";
import logsRouter from "./routes/logs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Root & Health check endpoints
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      status: "online",
      service: "Auto-Proposal Backend API",
      frontend_url: "http://localhost:5173",
      endpoints: {
        health: "/health",
        companies: "/api/companies",
        ai_settings: "/api/settings/ai"
      }
    });
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });


  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/companies/:companyId/templates", templatesRouter);
  const workflowPath = "/api/companies/:companyId/templates/:templateId";
  app.use(workflowPath, requireTemplate, serializeTemplateWrites, briefingRouter, variablesRouter, templateRouter, rulesRouter, proposalRouter, logsRouter);
  app.use("/api/companies", configurationsRouter);
  app.use("/api/companies", companiesRouter);
  app.use("/api/settings", settingsRouter);

  return app;
}

export default createApp;

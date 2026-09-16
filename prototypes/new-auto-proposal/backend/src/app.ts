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

  // Mount company, briefing, variables, template & pricing-rules routes
  app.use("/api/companies", briefingRouter);
  app.use("/api/companies", variablesRouter);
  app.use("/api/companies", templateRouter);
  app.use("/api/companies", rulesRouter);
  app.use("/api/companies", configurationsRouter);
  app.use("/api/companies", logsRouter);
  app.use("/api/companies", companiesRouter);
  app.use("/api/settings", settingsRouter);

  return app;
}

export default createApp;

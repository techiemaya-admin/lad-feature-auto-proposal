import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import companiesRouter from "./routes/companies.js";
import briefingRouter from "./routes/briefing.js";
import variablesRouter from "./routes/variables.js";

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

  // Mount company, briefing & variables routes
  app.use("/api/companies", briefingRouter);
  app.use("/api/companies", variablesRouter);
  app.use("/api/companies", companiesRouter);

  return app;
}

export default createApp;

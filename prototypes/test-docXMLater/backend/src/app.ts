import express, { type Request, type Response, type NextFunction } from "express"
import cors from "cors"
import { documentRouter } from "./routes/document.js"

export function createApp() {
  const app = express()

  // Middleware
  app.use(cors())
  app.use(express.json())

  // Health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() })
  })

  // Document routes
  app.use("/api/document", documentRouter)

  // Centralized Error Handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled API Error:", err)
    const message = err instanceof Error ? err.message : "Internal Server Error"
    res.status(500).json({ error: message })
  })

  return app
}

export const app = createApp()

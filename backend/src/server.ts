import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config();

import { createApp } from "./app.js";
import { initDatabase } from "./db/database.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Initialize database & table structures
try {
  initDatabase();
  console.log("[Backend] SQLite database initialized successfully.");
} catch (err) {
  console.error("[Backend] Failed to initialize SQLite database:", err);
  process.exit(1);
}

const app = createApp();

app.listen(PORT, () => {
  console.log(`[Backend] Auto-Proposal Server running on http://localhost:${PORT}`);
});

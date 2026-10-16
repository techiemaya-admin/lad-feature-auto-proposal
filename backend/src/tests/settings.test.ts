import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase } from "../db/database.js";

test("AI settings default to deepseek-flash and survive a restart", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-settings-"));
  const dbPath = path.join(dir, "test.sqlite");
  process.env.DB_PATH = dbPath; // getDatabase() opens DB_PATH, not the path handed to initDatabase()
  process.env.STORAGE_DIR = path.join(dir, "storage");
  initDatabase(dbPath);
  try {
    const app = createApp();
    const before = await request(app).get("/api/settings/ai");
    assert.deepEqual(before.body.settings, { provider: "deepseek", model: "deepseek-flash" });

    const put = await request(app).put("/api/settings/ai").send({ model: "gemini-pro-latest" });
    assert.equal(put.body.settings.model, "gemini-pro-latest");

    // Simulate a restart: drop the in-memory cache by reopening the same database file.
    closeDatabase();
    initDatabase(dbPath);
    const after = await request(createApp()).get("/api/settings/ai");
    assert.equal(after.body.settings.model, "gemini-pro-latest");
  } finally {
    closeDatabase();
  }
});

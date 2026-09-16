import fs from "node:fs";
import path from "node:path";
import { Router, Request, Response } from "express";
import { LOG_ROOT } from "../services/pipeline-log.js";

const router = Router();

// ponytail: prototype-only. Serves the debug artifacts pipeline-log.ts drops on disk so the Dev Dock
// can show them. The real build ships structured logs to an observability sink — no equivalent endpoint there.
const ARTIFACT_LIMIT = 20;
const SAFE_NAME = /^[\w.-]+$/; // basename only: no separators, no "..", so a client can't walk out of its dir

export interface LogArtifact {
  file: string;
  kind: string; // "variables-raw.json", "template.md", ...
  logged_at: string; // local stamp from the filename, e.g. "2026-09-16 11:46:39 AM"
  size: number;
}

/** "2026-09-16_11-46-39-810AM-rules-raw.json" -> { logged_at, kind } */
function parseStamp(file: string): Pick<LogArtifact, "kind" | "logged_at"> {
  const m = /^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})-\d{3}(AM|PM)-(.+)$/.exec(file);
  return m
    ? { logged_at: `${m[1]} ${m[2]}:${m[3]}:${m[4]} ${m[5]}`, kind: m[6] }
    : { logged_at: "", kind: file };
}

function companyDir(id: string): string | null {
  if (!SAFE_NAME.test(id)) return null;
  const dir = path.join(LOG_ROOT, id);
  return fs.existsSync(dir) ? dir : null;
}

// GET /api/companies/:id/logs - newest ARTIFACT_LIMIT artifacts for the company
router.get("/:id/logs", (req: Request, res: Response): void => {
  const dir = companyDir(req.params.id);
  if (!dir) {
    res.json({ success: true, artifacts: [] });
    return;
  }
  const artifacts: LogArtifact[] = fs
    .readdirSync(dir)
    .filter((f) => SAFE_NAME.test(f))
    .sort()
    .reverse()
    .slice(0, ARTIFACT_LIMIT)
    .map((file) => ({ file, ...parseStamp(file), size: fs.statSync(path.join(dir, file)).size }));
  res.json({ success: true, artifacts });
});

// GET /api/companies/:id/logs/:file - one artifact's contents as text
router.get("/:id/logs/:file", (req: Request, res: Response): void => {
  const { file } = req.params;
  const dir = companyDir(req.params.id);
  const target = dir && SAFE_NAME.test(file) ? path.join(dir, file) : null;
  if (!target || !fs.existsSync(target)) {
    res.status(404).json({ success: false, error: "Artifact not found" });
    return;
  }
  res.type("text/plain").send(fs.readFileSync(target, "utf8"));
});

export default router;

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// prototypes/new-auto-proposal/logs/<company_id>/<timestamp>-<name>
// (mirrors getStorageDir's __dirname-relative resolution so it works from dist/ and src/)
const LOG_ROOT = path.resolve(__dirname, "../../../logs");

/** Local-time, filename-safe stamp: YYYY-MM-DD_hh-mm-ss-mmmAM */
function localStamp(d = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const h = d.getHours();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(h % 12 || 12)}-${p(d.getMinutes())}-${p(d.getSeconds())}-${p(d.getMilliseconds(), 3)}${h < 12 ? "AM" : "PM"}`;
}

/**
 * Best-effort artifact logger for the prototype pipeline (AI JSON, anydoc markdown).
 * Never throws — a logging failure must not break the request.
 */
export function logPipelineArtifact(
  companyId: string,
  name: string,
  content: string | object
): void {
  try {
    const dir = path.join(LOG_ROOT, companyId);
    fs.mkdirSync(dir, { recursive: true });
    const ts = localStamp();
    const body = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    fs.writeFileSync(path.join(dir, `${ts}-${name}`), body, "utf8");
  } catch (err) {
    console.warn(`[pipeline-log] failed to write ${name} for ${companyId}:`, err);
  }
}

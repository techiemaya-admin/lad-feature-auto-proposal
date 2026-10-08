// Prebuild gate: every `PROD-GAP:` comment marks a shortcut that is fine in the
// prototype but a defect in production. Printed as a warning on every build;
// the build still succeeds. Delete a marker only once production handles it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
};

let n = 0;
for (const file of walk(SRC)) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    const at = line.indexOf("PROD-GAP:");
    if (at !== -1) {
      n++;
      console.warn(`warning PROD-GAP ${relative(SRC, file)}:${i + 1}: ${line.slice(at + 9).trim()}`);
    }
  });
}
console.warn(n ? `prebuild: ${n} production gap(s) still open (see above)` : "prebuild: no production gaps");

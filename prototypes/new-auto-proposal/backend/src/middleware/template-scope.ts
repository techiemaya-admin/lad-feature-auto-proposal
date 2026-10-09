import type { RequestHandler } from "express";
import { loadTemplate } from "../repositories/templates.repository.js";

const writing = new Set<string>();

/** POST endpoints that never mutate template state: pure evaluation/drafting with timestamped logs only. */
const READ_ONLY_POSTS = new Set([
  "/rules/calculate",
  "/lead/extract",
  "/lead/clarify",
  "/lead/reply",
]);

/** A reset/delete cannot race an in-flight extraction or compilation for the same template. */
export const serializeTemplateWrites: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  // Match against the full path so this works both in the workflow mount
  // (req.url is stripped to e.g. "/rules/calculate") and in the management
  // router (req.url still contains the template id, e.g. "/t1/reset").
  const fullPath = (req.originalUrl || req.url).split("?")[0];
  if (req.method === "POST" && [...READ_ONLY_POSTS].some((p) => fullPath.endsWith(p))) return next();
  const key = `${req.params.companyId}:${req.params.templateId}`;
  if (writing.has(key)) {
    res.status(409).json({ success: false, error: "This template is busy. Wait for the current operation to finish and retry." });
    return;
  }
  writing.add(key);
  // `finish` never fires when the client aborts mid-request; without `close` the key
  // leaks and every later write for this template returns 409 until the server restarts.
  const release = () => writing.delete(key);
  res.once("finish", release);
  res.once("close", release);
  next();
};

/** Runs before uploads as well as reads; URL IDs never grant cross-company access. */
export const requireTemplate: RequestHandler = (req, res, next) => {
  const { companyId, templateId } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(companyId || "") || !/^[a-zA-Z0-9_-]+$/.test(templateId || "") || !loadTemplate(companyId, templateId)) {
    res.status(404).json({ success: false, error: "Template not found for this company" });
    return;
  }
  next();
};

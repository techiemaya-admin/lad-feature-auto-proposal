import type { RequestHandler } from "express";
import { loadTemplate } from "../repositories/templates.repository.js";

const writing = new Set<string>();
/** A reset/delete cannot race an in-flight extraction or compilation for the same template. */
export const serializeTemplateWrites: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const key = `${req.params.companyId}:${req.params.templateId}`;
  if (writing.has(key)) {
    res.status(409).json({ success: false, error: "This template is busy. Wait for the current operation to finish and retry." });
    return;
  }
  writing.add(key);
  res.once("finish", () => writing.delete(key));
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

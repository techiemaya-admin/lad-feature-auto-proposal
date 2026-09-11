import { Router, Request, Response } from "express";
import { getAISettings, setAISettings, MODELS } from "../services/ai-settings.service.js";

const router = Router();

// GET /api/settings/ai - Current provider/model + available models for the UI dropdown
router.get("/ai", (_req: Request, res: Response): void => {
  res.json({ success: true, settings: getAISettings(), models: MODELS });
});

// PUT /api/settings/ai - Switch provider and/or model for all subsequent extraction calls
router.put("/ai", (req: Request, res: Response): void => {
  try {
    const { provider, model } = req.body || {};
    const settings = setAISettings({ provider, model });
    res.json({ success: true, settings });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update AI settings",
    });
  }
});

export default router;

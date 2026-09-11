import { extractVariablesWithGemini, type ExtractionResponse, type ExtractVariablesParams } from "./gemini.service.js";
import { extractVariablesWithDeepSeek } from "./deepseek.service.js";
import { getAISettings } from "./ai-settings.service.js";

// Single entry point the routes call — routes never pick a provider themselves.
export async function extractVariables(params: ExtractVariablesParams): Promise<ExtractionResponse> {
  const { provider, model } = getAISettings();
  return provider === "deepseek"
    ? extractVariablesWithDeepSeek(params, model)
    : extractVariablesWithGemini(params, model);
}

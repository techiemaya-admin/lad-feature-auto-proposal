import type { ResponseSchema } from "@google/generative-ai";
import { extractVariablesWithGemini, generateJsonWithGemini, type ExtractionResponse, type ExtractVariablesParams } from "./gemini.service.js";
import { extractVariablesWithDeepSeek, generateJsonWithDeepSeek } from "./deepseek.service.js";
import { getAISettings } from "./ai-settings.service.js";

// Single entry point the routes call — routes never pick a provider themselves.
let extractionOverride: ((params: ExtractVariablesParams) => Promise<ExtractionResponse>) | null = null;

/** Offline route tests can replace the model call without changing persistence behavior. */
export function setExtractionModelCall(call: typeof extractionOverride): void {
  extractionOverride = call;
}

export async function extractVariables(params: ExtractVariablesParams): Promise<ExtractionResponse> {
  if (extractionOverride) return extractionOverride(params);
  const { provider, model } = getAISettings();
  return provider === "deepseek"
    ? extractVariablesWithDeepSeek(params, model)
    : extractVariablesWithGemini(params, model);
}

/**
 * Provider-agnostic structured output. Gemini enforces `schema`; DeepSeek has no typed schema,
 * so `jsonShapeSuffix` spells the same shape out in the prompt.
 */
export async function generateJson<T>(prompt: string, schema: ResponseSchema, jsonShapeSuffix: string): Promise<T> {
  const { provider, model } = getAISettings();
  return provider === "deepseek"
    ? generateJsonWithDeepSeek<T>(prompt, jsonShapeSuffix, model)
    : generateJsonWithGemini<T>(prompt, schema, model);
}

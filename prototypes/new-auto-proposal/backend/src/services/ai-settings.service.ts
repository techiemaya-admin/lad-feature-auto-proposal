export type AIProvider = "gemini" | "deepseek";

export interface AISettings {
  provider: AIProvider;
  model: string;
}

export const MODELS: Record<AIProvider, string[]> = {
  gemini: ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-pro-latest", "gemini-2.5-flash"],
  deepseek: ["deepseek-flash", "deepseek-v4-pro"],
};

// In-memory only — single-process dev prototype, no persistence needed.
let current: AISettings = { provider: "gemini", model: MODELS.gemini[0] };

export function getAISettings(): AISettings {
  return current;
}

export function setAISettings(next: { provider?: string; model?: string }): AISettings {
  const provider = (next.provider as AIProvider) ?? current.provider;
  if (provider !== "gemini" && provider !== "deepseek") {
    throw new Error(`Unknown AI provider "${next.provider}"`);
  }

  const providerChanged = provider !== current.provider;
  const model = next.model?.trim() || (providerChanged ? MODELS[provider][0] : current.model);

  current = { provider, model };
  return current;
}

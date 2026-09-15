import { getDatabase } from "../db/database.js";

export type AIProvider = "gemini" | "deepseek";

export interface AISettings {
  provider: AIProvider;
  model: string;
}

// First entry per provider is that provider's default. gemini-flash-lite drops money amounts from the
// extraction in most runs (measured: 3 of 4 on Co1) — it stays selectable but is never the accident.
export const MODELS: Record<AIProvider, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-flash-latest", "gemini-pro-latest", "gemini-flash-lite-latest"],
  deepseek: ["deepseek-flash", "deepseek-v4-pro"],
};

// deepseek-flash extracted every amount on all three mock quotations (logs/*/variables-raw.json, 2026-09-15).
const DEFAULT: AISettings = { provider: "deepseek", model: MODELS.deepseek[0] };
const KEY = "ai";

// Persisted in SQLite so a server restart never silently downgrades the model mid-session.
// Read on every call: it happens once per extraction, so a cache would only add a stale-after-restart path.
export function getAISettings(): AISettings {
  const row = getDatabase().prepare("SELECT value_json FROM app_settings WHERE key = ?").get(KEY) as { value_json: string } | undefined;
  return row ? { ...DEFAULT, ...JSON.parse(row.value_json) } : DEFAULT;
}

export function setAISettings(next: { provider?: string; model?: string }): AISettings {
  const prev = getAISettings();
  const provider = (next.provider as AIProvider) ?? prev.provider;
  if (provider !== "gemini" && provider !== "deepseek") {
    throw new Error(`Unknown AI provider "${next.provider}"`);
  }

  const providerChanged = provider !== prev.provider;
  const model = next.model?.trim() || (providerChanged ? MODELS[provider][0] : prev.model);

  const settings: AISettings = { provider, model };
  getDatabase()
    .prepare("INSERT INTO app_settings (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json")
    .run(KEY, JSON.stringify(settings));
  return settings;
}

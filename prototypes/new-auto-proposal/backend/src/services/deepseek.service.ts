import {
  buildExtractionPrompt,
  type ExtractionResponse,
  type ExtractVariablesParams,
} from "./gemini.service.js";

/**
 * DeepSeek's API is OpenAI-compatible chat completions (no typed response
 * schema like Gemini's responseSchema), so the required JSON shape is spelled
 * out in the prompt and enforced with response_format: json_object.
 */
const JSON_SHAPE_INSTRUCTIONS = `
==================== OUTPUT FORMAT ====================
Respond with ONLY a single JSON object — no markdown fences, no commentary — matching exactly this shape:
{
  "document_summary": string,
  "variables": [
    {
      "variable_name": string, "natural_name": string,
      "category": "customer_input" | "pricing" | "paragraph",
      "data_type": "string" | "number" | "currency" | "enum" | "paragraph",
      "sample_text": string, "description": string, "context_text": string, "condition_flag": string,
      "enum_options": string[] (optional),
      "paragraph_config": { "mode": "fixed" | "ai_generated", "purpose": string, "tone": string, "length_guideline": string } (optional)
    }
  ],
  "loop_tables": [
    { "loop_tag": string, "natural_name": string, "header_texts": string[], "column_tags": string[], "row_labels": string[] }
  ]
}
Every field above without "(optional)" is required, use "" for not-applicable strings.
`;

/** One JSON-mode chat completion: prompt + spelled-out shape in, parsed JSON out. Every DeepSeek feature goes through here. */
export async function generateJsonWithDeepSeek<T>(prompt: string, jsonShapeSuffix: string, model = "deepseek-flash"): Promise<T> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY environment variable is not set");
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt + jsonShapeSuffix }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`DeepSeek API request failed (${res.status}): ${errorBody || res.statusText}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek response did not include message content");
  }

  try {
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse DeepSeek structured output JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function extractVariablesWithDeepSeek(params: ExtractVariablesParams, model?: string): Promise<ExtractionResponse> {
  return generateJsonWithDeepSeek<ExtractionResponse>(buildExtractionPrompt(params), JSON_SHAPE_INSTRUCTIONS, model);
}

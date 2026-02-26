const { GoogleGenerativeAI } = require("@google/generative-ai");

class AIService {
  constructor() {
    this.geminiModels = [];
    this.currentApiKeyIndex = 0;
    this.setupGeminiAPI();
  }

  setupGeminiAPI() {
    try {
      const apiKeys = [];

      for (let i = 1; i <= 9; i++) {
        let key =
          i === 1
            ? process.env.GEMINI_API_KEY
            : process.env[`GEMINI_API_KEY_${i}`];

        if (key && !key.startsWith("your_")) {
          apiKeys.push(key);
        }
      }

      if (!apiKeys.length) {
        throw new Error("No valid Gemini API keys found.");
      }

      apiKeys.forEach((apiKey, index) => {
        try {
          const client = new GoogleGenerativeAI(apiKey);

          this.geminiModels.push({
            client,
            keyIndex: index,
            requestsCount: 0,
            lastUsed: null,
          });

          console.log(`✅ Gemini API Key ${index + 1} configured`);
        } catch (err) {
          console.log(`❌ Error setting up key ${index + 1}`, err.message);
        }
      });

      console.log(
        `🎯 Total Gemini API keys configured: ${this.geminiModels.length}`
      );
    } catch (err) {
      console.error("Gemini setup failed:", err.message);
      throw err;
    }
  }

  getNextApiKey() {
    if (!this.geminiModels.length) return null;

    const rotation =
      (process.env.GEMINI_KEY_ROTATION || "true").toLowerCase() === "true";

    if (rotation) {
      const modelInfo = this.geminiModels[this.currentApiKeyIndex];
      this.currentApiKeyIndex =
        (this.currentApiKeyIndex + 1) % this.geminiModels.length;
      return modelInfo;
    } else {
      return this.geminiModels[0];
    }
  }

  updateUsage(modelInfo) {
    modelInfo.requestsCount += 1;
    modelInfo.lastUsed = new Date();
  }

  async generateAIResponse(emailContent) {
    try {
      const modelInfo = this.getNextApiKey();
      console.log(
        "Using Gemini API Key Index:",
        modelInfo ? modelInfo.keyIndex : "None"
      );

      if (!modelInfo) return this.getFallbackResponse();

      const prompt = `
You are an AI information extraction system.

Extract structured event details from this email.

Return ONLY valid raw JSON.
No markdown.
No explanation.

Fields:
- location (city or country)
- event_type (type of event requested)
- pax (integer)
- duration (in hours, float)

Rules:
- Fix spelling mistakes (e.g., "dubi" → "Dubai", "pprox" → "approx")
- Convert numbers in words to integers
- Convert minutes to fraction of hours
- If a field is missing, return "null"
- Do NOT include JSON, markdown, or explanation


Email:
"${emailContent}"
`;


      // ✅ Correct SDK usage
      const model = modelInfo.client.getGenerativeModel({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      });

      const result = await model.generateContent(prompt);

      this.updateUsage(modelInfo);

      const text = result.response.text();
let cleanedText = text.trim();

// Remove ```json and ```
if (cleanedText.startsWith("```")) {
  cleanedText = cleanedText
    .replace(/```json/i, "")
    .replace(/```/g, "")
    .trim();
}

const parsed = JSON.parse(cleanedText);
      return parsed;
    } catch (err) {
      console.error("AI Generation Error:", err.message);
    
    }
  }

  getApiStats() {
    return this.geminiModels.map((model, index) => ({
      keyNumber: index + 1,
      requestsCount: model.requestsCount,
      lastUsed: model.lastUsed
        ? model.lastUsed.toLocaleTimeString()
        : "Never",
    }));
  }
}

module.exports = new AIService();
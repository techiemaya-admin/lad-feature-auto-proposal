const { GoogleGenerativeAI } = require("@google/generative-ai");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { generatePDF } = require("../../../utils/pdfGenerator");
const { uploadToGCS } = require("../../../utils/gcsUploader");

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
- event_category (type of event: e.g., wedding, corporate, birthday, family_gathering, etc.)
- event_type (type of event requested , LITE or IMPACT)
- location
- guest_counts (object with possible keys: main_event, catering, function_hall)
- services_requested array of strings)
- support_level (basic_support, partial_management, full_event_management)
- inquiry_type (must be ONE of: "pricing", "availability", "booking", "general", null)
- duration (in hours, float)
- client_type (must be one of: "B2B", "B2C", null)


Classification Rules:
- If email explicitly says "LITE" → event_type = "LITE"
- If email explicitly says "IMPACT" → event_type = "IMPACT"
- If it describes small-scale, casual, short-duration, low-complexity events, light, fun, casual, short, relaxed event → classify as "LITE"
- If it describes large-scale, premium, high-budget, complex, full-service events, intense, premium, powerful, grand, high-energy event → classify as "IMPACT"
- If unclear → return null

Client Type Rules:
- Corporate/company/organization events → B2B
- Personal events (wedding, birthday, private celebration) → B2C
- If unclear → null

Inquiry Type Rules:

- Determine the PRIMARY intent only.
- If multiple intents exist, use this priority: booking > pricing > availability > general.
- Return only one value.



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

   async generateQuotationProposal(data) {
    console.log("data : "+data)
    try {
      
      const modelInfo = this.getNextApiKey();
      console.log(
        "Using Gemini API Key Index:",
        modelInfo ? modelInfo.keyIndex : "None"
      );

      if (!modelInfo) return this.getFallbackResponse();

      const model = modelInfo.client.getGenerativeModel({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      });


const prompt = `
You are a professional document formatting system.

Generate a clean, professional event quotation formatted EXACTLY as described below.

STRICT FORMAT REQUIREMENTS:

1. Title at top:
   Quotation

2. Section Header:
   Event Details

3. Bullet point list under Event Details:
   - Location: <value>
   - Event Category: <value>
   - Main Event Guests: <value>
   - Catering Guests: <value>
   - Function Hall Guests: <value>

4. Generate pricing table EXACTLY in this format with proper spacing and alignment. Also put it in table : 
   Category | Main Event (AED) | Catering (AED) | Function Hall (AED) | Total (AED)

5. Two rows only:
   LITE
   IMPACT

6. Section Header:
   Notes

7. Bullet points under Notes:
   - Prices are subject to 5% VAT.
   - Venue, AV setup, staging, and permits are not included unless specified.
   - Final pricing may vary depending on customization and venue policies.
   - A 15% discount applies if multiple team-building concepts are booked on the same day.

IMPORTANT RULES:
- Do NOT change any numbers.
- Do NOT add extra commentary.
- Do NOT assume missing values.
- Use proper spacing and alignment.
- Return clean formatted plain text only.
- Do NOT use markdown.
- Do NOT use code blocks.

Use this DATA exactly:

${JSON.stringify(data)}
`;
      const result = await model.generateContent(prompt);
      const quotationText = result.response.text().trim();

      // Generate PDF
      const fileName = `quotation-${uuidv4()}.pdf`;
      const localPath = path.join(__dirname, "../", fileName);

      await generatePDF(data,localPath);
      
      // Upload to GCS
      const gcsUrl = await uploadToGCS(localPath, fileName);
console.log("gcsUrl: "+gcsUrl)
      // Save draft in proposal draft DB
      
       return {"gcsUrl":gcsUrl,"fileName":fileName};
    } catch (err) {
      console.error("Quotation Generation Error:", err);
      throw err;
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
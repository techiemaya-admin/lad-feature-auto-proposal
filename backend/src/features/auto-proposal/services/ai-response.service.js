const { GoogleGenerativeAI } = require("@google/generative-ai");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { generatePDF } = require("../../../utils/pdfGenerator");
const { uploadToGCS } = require("../../../utils/gcsUploader");
const leadRequirementConfigRepo = require("../repositories/lead_requirement_config.repository");
const puppeteer = require('puppeteer');
const proposalDraftService = require('./proposal-draft.service');
const conceptRepo = require("../repositories/concept.repository");

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

  async generateAIResponse(emailContent, tenant_id) {
    try {
      const modelInfo = this.getNextApiKey();
      console.log(
        "Using Gemini API Key Index:",
        modelInfo ? modelInfo.keyIndex : "None"
      );
      // fetch lead_requirement_config for tenant and include in prompt for better accuracy.
      if (!modelInfo) return this.getFallbackResponse();

      // 1. Fetch active concepts for this tenant
      const concepts = await conceptRepo.findAll(tenant_id);
      console.log("Fetched concepts for tenant:", tenant_id, concepts.length);
      const conceptNames = concepts.map(c => c.name).join(', '); // e.g., "LITE, IMPACT, PREMIUM"
      console.log("Fetched concepts for prompt:", conceptNames);
      // Fetch the full config objects instead of just keys
      const configs = await leadRequirementConfigRepo.findByTenantAndActive(tenant_id);

      // Create a detailed map for the AI
      const dynamicFieldsPrompt = configs.map(c =>
        `- ${c.field_key}: (${c.label})`
      ).join('\n');

      // Create a sample JSON structure for the AI to follow
      const dynamicJsonStructure = configs.reduce((acc, c) => {
        acc[c.field_key] = "value or null";
        return acc;
      }, {});
      console.log("dynamicJsonStructure: " + JSON.stringify(dynamicJsonStructure));
      concepts.forEach(concept => {
        console.log(`Concept: ${JSON.stringify(concept)}`);
      });
      // Example logic to prepare the prompt variables
      const conceptServicesMapping = concepts.map(c =>
        `${c.name}: [${c.requirement_configs.map(r => r.field_key).join(', ')}]`
      ).join('\n');

      // ... (Keep your existing schema and mapping variables)

      const prompt = `
    You are an expert Data Extraction AI. 
    Extract structured event details from the provided email and map them PRECISELY to the following custom schema.

    ### CUSTOM SCHEMA FIELDS (MANDATORY):
    ${dynamicFieldsPrompt}

    ### STANDARD FIELDS:
    - location: (City or Country)
    - event_category: (wedding, corporate, birthday, etc.)
    - support_level: (basic_support, partial_management, full_event_management)
    - inquiry_type: (booking > pricing > availability > general)
    - duration: (in hours, float)
    - client_type: (B2B for corporate, B2C for personal)
    - services_requested: (array of strings extracted from the email)

    ### EVENT CLASSIFICATION (CRITICAL):
    You must determine the "event_type" by matching the services requested in the email against the Concept Service Mapping below. 
    Pick the Concept that includes the most "services_requested" found in the email.

    **CONCEPT SERVICE MAPPING:**
    ${conceptServicesMapping}

    - event_type: (Must be one of [${conceptNames}]. Select based on which concept's services most closely align with the email content.)

    ### EXTRACTION RULES:
    1. Map values ONLY to the keys provided in the CUSTOM SCHEMA.
    2. FIXED NUMERIC RULE: For keys like "pax", "guest_count", "catering", or "function_hall", extract ONLY the specific numeric value associated with that service in the email.
    3. NO BOOLEANS: Do not use "yes", "no", or "true/false". If a number is mentioned (e.g., "catering for 100 persons"), the value for "catering" must be 100.
    4. MAPPING COUNTS: If the email says "Function hall for 100 members", map the number 100 to the "function_hall" key.
    5. NULL VALUES: If a service is mentioned but NO specific count/number is provided for it, return null. (e.g., If they want "Videography" but don't say "for X hours" or "X cameras", return "Videography": null).
    6.Fix spelling (e.g., "dubai" -> "Dubai").
    7. Return ONLY raw valid JSON. No markdown, no backticks, no explanations.

    ### REQUIRED JSON STRUCTURE:
    {
      "dynamic_requirements": ${JSON.stringify(dynamicJsonStructure)},
      "location": null,
      "event_category": null,
      "event_type": "Select Concept Name based on Service Mapping",
      "support_level": null,
      "inquiry_type": null,
      "duration": null,
      "client_type": null,
      "services_requested": []
    }

    Email Content:
    "${emailContent}"
`;
      // const prompt = `
      // You are an expert Data Extraction AI. 
      // Extract structured event details from the provided email and map them PRECISELY to the following custom schema.

      // ### CUSTOM SCHEMA FIELDS (MANDATORY):
      // ${dynamicFieldsPrompt}

      // ### STANDARD FIELDS:
      // - location: (City or Country)
      // - event_type: (Must be one of [${conceptNames}] or null. Classify based on email content. If unclear, return null.)
      // - event_category: (wedding, corporate, birthday, etc.)
      // - support_level: (basic_support, partial_management, full_event_management)
      // - inquiry_type: (booking > pricing > availability > general)
      // - duration: (in hours, float)
      // - client_type: (B2B for corporate, B2C for personal)
      // - services_requested: (array of strings)

      // ### EXTRACTION RULES:
      // 1. Map values ONLY to the keys provided in the CUSTOM SCHEMA.
      // 2. If the email mentions a value that fits a custom field (e.g., "50 guests" for a key named "pax"), assign it to that key.
      // 3. Fix spelling (e.g., "dubai" -> "Dubai").
      // 4. Return ONLY raw valid JSON. No markdown, no backticks, no explanations.


      // Rules:
      // - Fix spelling mistakes (e.g., "dubi" → "Dubai", "pprox" → "approx")
      // - Convert numbers in words to integers
      // - Convert minutes to fraction of hours
      // - If a field is missing, return "null"
      // - Do NOT include JSON, markdown, or explanation


      // Inquiry Type Rules:

      // - Determine the PRIMARY intent only.
      // - If multiple intents exist, use this priority: booking > pricing > availability > general.
      // - Return only one value.


      // Client Type Rules:
      // - Corporate/company/organization events → B2B
      // - Personal events (wedding, birthday, private celebration) → B2C
      // - If unclear → null

      // ### Rules for event_type (VALID CONCEPTS (Use for event_type)):
      // - [${conceptNames}]
      // You MUST pick the closest matching name from this list: [${conceptNames}]. 
      // Do NOT return null if there is enough info to guess the scale of the event.

      // ### REQUIRED JSON STRUCTURE:
      // {
      //   "dynamic_requirements": ${JSON.stringify(dynamicJsonStructure)},
      //   "location": null,
      //   "event_category": null,
      //   "event_type": "Pick ONE from [${conceptNames}]",
      //   "support_level": null,
      //   "inquiry_type": null,
      //   "duration": null,
      //   "client_type": null,
      //   "services_requested": []

      // }

      // Email Content:
      // "${emailContent}"
      // `;

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
      console.error("AI Generation Error:", err);

    }
  }

  async generateQuotationProposal(data, leadDetails, event_type, tenantDetails) {
    try {
      const fileName = `quotation-${uuidv4()}.pdf`;
      const localPath = path.join(__dirname, "../", fileName);

      // 1. Launch Puppeteer
      const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox']
      });
      const page = await browser.newPage();

      // 2. Generate the HTML from the modal-copy template
      const html = await proposalDraftService.generateProposalForLeadHtml(data,
        leadDetails,
        event_type,
        tenantDetails);

      await page.setContent(html, { waitUntil: 'networkidle0' });

      // 3. Print to PDF in Landscape to match the modal width
      await page.pdf({
        path: localPath,
        format: 'A4',
        landscape: true,
        printBackground: true, // MUST be true for the indigo background
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      });

      await browser.close();

      // 4. Upload to GCS (Existing logic)
      const gcsUrl = await uploadToGCS(localPath, fileName);
      console.log("Generated PDF GCS URL:", gcsUrl);
      return { gcsUrl, fileName };
    } catch (err) {
      console.error("PDF Generation Failed:", err);
      throw err;
    }
  }

  async generateQuotationProposalWithAI(data) {
    console.log("data : " + data)
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

      await generatePDF(data, localPath);

      // Upload to GCS
      const gcsUrl = await uploadToGCS(localPath, fileName);
      console.log("gcsUrl: " + gcsUrl)
      // Save draft in proposal draft DB

      return { "gcsUrl": gcsUrl, "fileName": fileName };
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
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { generatePDF } = require("../../../utils/pdfGenerator");
const { uploadToGCS } = require("../../../utils/gcsUploader");
const leadRequirementConfigRepo = require("../repositories/lead_requirement_config.repository");
const puppeteer = require('puppeteer');
const proposalDraftService = require('./proposal-draft.service');
const conceptRepo = require("../repositories/concept.repository");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const templateRepository = require("../repositories/quotation-template-metadata.repository");
const libre = require('libreoffice-convert');
const { promisify } = require('util');
const fs = require('fs').promises;
const quotationTemplateMetadataRepository = require("../repositories/quotation-template-metadata.repository");
const placeholderRepo = require('../repositories/quotation-placeholder.repository');
const _ = require('lodash');
const axios = require('axios'); // You'll need this to fetch the file from the URL
const mammoth = require("mammoth");
const pricngRuleRepo = require('../repositories/pricingRule.repository')
const { Storage } = require("@google-cloud/storage");
const { uploadBufferToGCS } = require('../../../utils/gcsUploader');
const storage = new Storage({
  keyFilename: process.env.GCS_KEY_FILE, // service-account.json
});

const ImageModule = require("docxtemplater-image-module-free");
const convertAsync = promisify(libre.convert);
const sizeOf = require("image-size"); // npm install image-size
const conversationMessageRepository = require("../repositories/conversation-message.repository");

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


  async callGenAI(prompt) {

    const modelInfo = this.getNextApiKey();
    console.log(
      "Using Gemini API Key Index:",
      modelInfo ? modelInfo.keyIndex : "None"
    );
    if (!modelInfo) return this.getFallbackResponse();


    // ✅ Correct SDK usage
    const model = modelInfo.client.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    });

    let retries = 5;
    for (let i = 0; i < retries; i++) {
      try {
        console.log("send request to gemini")
        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log(`Response fetched from gen AI after attempt : ${i}`)
        return response.text();
      } catch (err) {
        if (err.message.includes("503") && i < retries - 1) {
          console.log(`Retrying... attempt ${i + 1}`);
          await new Promise((res) => setTimeout(res, 20000)); // wait 2s
        } else {
          throw err;
        }
      }
    }
  }


  async callGenAIWithConfig(prompt, generationConfig) {

    const modelInfo = this.getNextApiKey();
    console.log(
      "Using Gemini API Key Index:",
      modelInfo ? modelInfo.keyIndex : "None"
    );
    if (!modelInfo) return this.getFallbackResponse();


    // ✅ Correct SDK usage

    const model = modelInfo.client.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig,
    });

    let retries = 3;
    for (let i = 0; i < retries; i++) {
      try {
        console.log("send request to gemini")
        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log(`Response fetched from gen AI after attempt : ${i}`)
        const resp = JSON.parse(response.text())
        console.log("REsponse:: " + JSON.stringify(resp));
        return resp;
      } catch (err) {
        if (err.message.includes("503") && i < retries - 1) {
          console.log(`Retrying... attempt ${i + 1}`);
          await new Promise((res) => setTimeout(res, 20000)); // wait 2s
        } else {
          throw err;
        }
      }
    }
  }

  async generateAIResponse(emailContent, tenant_id, conversation_id) {
    try {
      const rawHistory = await conversationMessageRepository.findTop10EmailByTenantIdAndConversationId(tenant_id, conversation_id);

      // Clean HTML from history content and format for AI
      const formattedHistory = rawHistory
        .reverse() // Oldest to newest
        .map(m => {
          const role = m.sender_type === 'lead' ? 'Customer' : 'Assistant';
          const cleanContent = this.stripHtml(m.content);
          return `${role}: ${cleanContent}`;
        })
        .join('\n');

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
    You are an expert Data Extraction and Service Matching AI. 
    Your goal is to extract structured details from a lead's email and ensure every requested service has a valid numeric quantity so a quotation can be generated.

    ### CONVERSATION HISTORY (FOR CONTEXT):
    ${formattedHistory}

    ### CUSTOM SCHEMA FIELDS (MANDATORY):
    ${dynamicFieldsPrompt}

    ### STANDARD FIELDS:
    - location: (City or Country)
    - event_category: (wedding, corporate, birthday, etc.)
    - event_type: (Must be one of [${conceptNames}]. Select based on which concept's services most closely align with the email content.)
    - support_level: (basic_support, partial_management, full_event_management)
    - inquiry_type: (booking > pricing > availability > general)
    - duration: (in hours, float)
    - client_type: (B2B for corporate, B2C for personal)
    - services_requested: (array of strings/keys extracted from the email)

    ### EXTRACTION & CONSULTATION RULES:
    1. **NO ZERO OR TEXT QUANTITIES**: For every key in "dynamic_requirements", you must return ONLY a Number or null. Never return text descriptions like "study permit process" inside numeric fields.
    2. **MANDATORY MINIMUM QUANTITY**: If a lead requests a service but does not specify a quantity (e.g., "I need visa help"), you MUST assign a value of **1**. This ensures the total price is never zero.
    3. **INTELLIGENT SERVICE MATCHING**: If the lead's demand is clear (e.g., "Canada study visa") but they don't list specific sub-services, check the CUSTOM SCHEMA and enable the service keys that are logically required to fulfill that demand (e.g., set "visa_assistance": 1).
    4. **SPECIFIC COUNT EXTRACTION**: If the email mentions a specific number (e.g., "100 guests"), extract ONLY that number for the corresponding key.
    5. **NULL FOR UNRELATED**: Return null ONLY for services that are completely unrelated to the lead's email content.
    6. **NO BOOLEANS**: Do not use "yes", "no", or "true". Use numbers only.
    7. **FORMATTING**: Return ONLY raw valid JSON. No markdown, no backticks, no explanations.
    
    ### DECISION LOGIC:
    1. ANALYZE HISTORY: Review the conversation history. Have we already answered their questions? Have we already sent a service list?
    2. INTENT CHECK: 
       - IF the email is just a greeting (e.g., "Hi", "Hello") OR a general inquiry (e.g., "What do you do?", "Price list please"): 
      Set "intent" to "GENERAL". 
      Write a warm "text_reply" that introduces our services (${conceptNames}) and specifically mentions: ${dynamicFieldsPrompt}. End by asking for their event details.

    - IF the email asks for a specific service or quote (e.g., "I need a wedding quote"): 
      Set "intent" to "SERVICE_REQUEST". 

    3. DISCOVERY RULE: If intent is "GENERAL", write a warm email. Mention these services ONLY if they haven't been mentioned in the history: ${conceptNames}.

    ### REQUIRED JSON STRUCTURE:
    {
    "intent": "GENERAL" | "SERVICE_REQUEST",
    "text_reply": "Natural email response for GENERAL intent, else null",
      "dynamic_requirements": ${JSON.stringify(dynamicJsonStructure)},
      "location": null,
      "event_category": null,
      "event_type": "Select Concept Name",
      "support_level": null,
      "inquiry_type": null,
      "duration": null,
      "client_type": null,
      "services_requested": []
    }

    Email Content:
    "${emailContent}"
`;

      const text = await this.callGenAI(prompt);
      // this.updateUsage(modelInfo);

      let cleanedText = text.trim();

      // Remove ```json and ```
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText
          .replace(/```json/i, "")
          .replace(/```/g, "")
          .trim();
      }

      const parsed = JSON.parse(cleanedText);
      if (parsed.intent === "GENERAL") {
        return {
          type: "DISCOVERY_EMAIL",
          content: parsed.text_reply
        };
      }
      console.log("Before update event_type : " + parsed.event_type)
      // 2. Identify the services the AI actually extracted (keys with non-null values)
      const extractedKeys = Object.keys(parsed.dynamic_requirements || {})
        .filter(k => parsed.dynamic_requirements[k] !== null && parsed.dynamic_requirements[k] !== 0);

      // 3. Logic to find the best-fitting concept
      let bestMatch = parsed.event_type; // Default to AI's choice
      let maxCount = 0;

      // ONLY run the check if we actually have concepts to compare against
      if (concepts && concepts.length > 0) {
        concepts.forEach(concept => {
          const conceptKeys = concept.requirement_configs.map(r => r.field_key);

          // Count how many of the AI's extracted keys belong to THIS concept
          const matchCount = extractedKeys.filter(k => conceptKeys.includes(k)).length;

          if (matchCount > maxCount) {
            maxCount = matchCount;
            bestMatch = concept.name;
          }
        });
      }

      // 4. Final Override
      // If we found a mathematical match, use it. 
      // If concepts was empty or no match found, bestMatch remains the AI's choice.
      parsed.event_type = bestMatch;
      console.log("After update event_type : " + parsed.event_type)
      return {
        type: "PROPOSAL_DATA",
        data: parsed
      };
    } catch (err) {
      console.error("AI Generation Error:", err);

    }
  }

  // Simple regex helper to strip HTML tags
  stripHtml(html) {
    if (!html) return "";
    return html
      .replace(/<style([\s\S]*?)<\/style>/gi, '') // Remove CSS
      .replace(/<script([\s\S]*?)<\/script>/gi, '') // Remove JS
      .replace(/<[^>]+>/g, ' ') // Remove Tags
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  };

  async fetchAIResponse(prompt) {


    const text = await this.callGenAI(prompt);
    // this.updateUsage(modelInfo);
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
  }

  async callConsultantAI(tenant_id, emailContent) {
    // 1. Construct the Discovery Prompt to find pre-requisite services
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

    const discoveryPrompt = `
    You are a Strategic Business Consultant.The initial data extraction failed to identify a billable quantity, resulting in a $0 quote.
    
    ### TASK:
    Analyze the lead's email and cross-reference it with the CUSTOM SCHEMA below. 
    Identify "Prerequisite Services," "Foundation Steps," or "Base Consultations" that are necessary to fulfill the lead's core demand.

    ### CONSULTATION LOGIC:
    1. ** Identify the Goal **: Determine what the client ultimately wants to achieve(e.g., moving abroad, hosting an event, enrolling in a school).
    2. ** Map Prerequisites **: Select the basic, entry - level services from the schema that are required to start that process(e.g., "Initial Consultation", "Profile Evaluation", "Site Visit", or "Discovery Session").
    3. ** Consultative Check **: If the lead's request is vague, select the most relevant "General Support" or "Administrative" service available in the schema.

    ### EXTRACTION RULES:
    - ** MANDATORY QUANTITY **: Every service you identify as a necessary prerequisite MUST have a numeric value of 1.
      - ** NO TEXT / BOOLEANS **: Do not return descriptions or "yes/no".Return ONLY numbers for the dynamic_requirements keys.
    - ** SCHEMA ONLY **: Only use keys provided in the CUSTOM SCHEMA below.

    ### CUSTOM SCHEMA FIELDS:
    ${dynamicFieldsPrompt}

    ### REQUIRED JSON STRUCTURE:
    {
      "dynamic_requirements": ${JSON.stringify(dynamicJsonStructure)},
      "consultant_reasoning": "Briefly explain why these prerequisite services are required to reach the client's goal.",
        "services_requested": ["list_of_enabled_keys"]
    }

    Email Content:
    "${emailContent}"
  `;

    try {

      // 3. Parse the JSON result
      const result = await this.fetchAIResponse(discoveryPrompt);

      // 4. Return only the dynamic_requirements object for the database update
      console.log("Consultant AI suggested:", JSON.stringify(result.dynamic_requirements));
      return result.dynamic_requirements;

    } catch (error) {
      console.error("Error in Consultant AI call:", error);
      return null;
    }
  }

  async generateProposalFromTemplate(data, tenantId) {
    // 1. Fetch the default template path from your metadata table
    const templateMetadata = await templateRepository.findDefaultByTenant(tenantId);
    console.log("templateMetadata:: " + templateMetadata)
    let fileName = `quotation - ${uuidv4()}.pdf`;
    fileName = `proposals/${fileName}`; // Add proposals/ prefix here
    const localPath = path.join(__dirname, "../", fileName);

    if (!templateMetadata) {
      // Handle case where no template is found for the tenant
      console.warn("No quotation template found , creating with static template");
      return await this.generateProposalWithoutQuotationTemplate(data, localPath, fileName);
    }

    try {

      let result = await this.generateDirectPdfFromDocx(tenantId, localPath, fileName, data);
      if (result === null) {
        return await this.generateProposalWithoutQuotationTemplate(data, localPath, fileName);
      } else {
        return result;
      }

    } catch (err) {
      console.error("PDF Generation Failed:", err);
      throw err;
    }
  }


  async generateProposalWithoutQuotationTemplate(data, localPath, fileName) {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    // 2. Generate the HTML from the modal-copy template
    const html = await proposalDraftService.generateProposalForLeadHtml(data);

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

  }

  async generateDirectPdfFromDocx(tenantId, localPath, fileName, data) {
    try {
      const SOCIAL_ICONS = {
        instagram_url: "https://cdn-icons-png.flaticon.com/32/174/174855.png",
        linkedin_url: "https://cdn-icons-png.flaticon.com/32/174/174857.png",
        whatsapp_url: "https://cdn-icons-png.flaticon.com/32/733/733585.png"
      };

      // 1. Fetch Template
      const template = await quotationTemplateMetadataRepository.findDefaultByTenant(tenantId);
      if (!template) throw new Error(`No default template for tenant ${tenantId}`);

      // 2. Convert .docx to HTML
      const bucket = storage.bucket(process.env.GCS_BUCKET);
      const [fileBuffer] = await bucket.file(template.storage_path).download();

      // 3. Replace Placeholders
      const templateData = { ...data, date: new Date().toLocaleDateString() };
      console.log(templateData)
      const zip = new PizZip(fileBuffer);
      // 1. Helper to fetch the image from your Signed URL
      const imageOptions = {
        getImage: async (tagValue) => {
          try {
            const res = await axios.get(tagValue, { responseType: 'arraybuffer' });
            return res.data;
          } catch (err) {
            console.error(`Failed to fetch image at ${tagValue}:`, err.message);
            return null;
          }
        },
        getSize: () => {
          return [100, 40]; // Fallback to a default size
        },
      };
      let doc;
      if (templateData.company_logo != '') {
        console.log(" image")
        // 2. Initialize Docxtemplater with the Image Module
        const imageModule = new ImageModule(imageOptions);
        doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          modules: [imageModule],
          delimiters: { start: "[", end: "]" }
        });
      } else {
        console.log("image not ")
        doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: { start: "[", end: "]" }
        });
      }

      // 5. Replace placeholders in the Docx
      await doc.renderAsync(templateData);

      // 6. Get the updated Docx as a Buffer
      const updatedDocxBuffer = doc.getZip().generate({ type: 'nodebuffer' });

      // 7. Convert that Word Buffer directly to PDF using LibreOffice
      // This preserves all branding, margins, and fonts from the original file
      const pdfBuffer = await convertAsync(updatedDocxBuffer, '.pdf', undefined);

      // 8. Save to Local Path (if needed) and Upload to GCS
      // You can upload the buffer directly to GCS instead of saving to disk
      const gcsUrl = await uploadBufferToGCS(pdfBuffer, fileName);
      // 4. Upload to GCS (Existing logic)
      // const gcsUrl = await uploadToGCS(localPath, fileName);
      console.log("Generated PDF GCS URL:", gcsUrl);
      return { gcsUrl, fileName };
    } catch (error) {
      console.error("CRITICAL GCS ERROR:", error.message);
      throw error;
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

  /* source: 29 - AIService.js */

  async suggestConcepts(tenantId) {
    console.log("tenantId:: " + tenantId)
    // 1. Fetch the configs and await the result
    const configs = await leadRequirementConfigRepo.findByTenantAndActive(tenantId);

    // 2. Validate data: If configs are empty, the AI cannot suggest anything meaningful
    if (!configs || configs.length === 0) {
      console.warn("No requirement configurations found for tenant:", tenantId);
      return { suggestions: [] };
    }

    // 3. Create a simplified list for the AI so it definitely sees the field_keys
    const configSummary = configs.map(c => ({
      field_key: c.field_key,
      label: c.label,
      category: c.category
    }));


    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                // CHANGED: requirement_config_ids is now an array of objects
                requirement_config_ids: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      id: { type: 'string' } // This will hold the UUID
                    },
                    required: ["name", "id"]
                  }
                },
                minimum_cost: { type: 'number' },
                description: { type: 'string' }
              },
              required: ["name", "requirement_config_ids", "minimum_cost", "description"]
            }
          }
        },
        required: ["suggestions"]
      }
    };
    // 4. Strengthen the Prompt Instructions
    const prompt = `
  Analyze these available Service Configurations:
  ${configs.map(c => `Service: ${c.label}, ID: ${c.id}`).join('\n')}

  TASK: Suggest 3-5 event concepts based on these services.
  
  RULES for 'requirement_config_ids':
  - This MUST be an array of objects.
  - Each object must have:
    1. "id": The UUID provided in the list above.
    2. "name": The "Service" (label) corresponding to that ID.
  
  Example format for requirement_config_ids:
  [{"name": "Catering", "id": "uuid-123"}, {"name": "Venue", "id": "uuid-456"}]

  Description Rule: Mention the service names used in the description for readability.
`;
    // Fix 4: Call generateContent with only the prompt (or an object with contents)

    return this.callGenAIWithConfig(prompt, generationConfig);

  }

  async suggestPricingRules(tenantId) {
    const requirementConfigs = await leadRequirementConfigRepo.findByTenantAndActive(tenantId);
    const concepts = await conceptRepo.findAll(tenantId);

    if (!requirementConfigs || requirementConfigs.length === 0) {
      return { suggestions: [] };
    }

    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                condition_name: { type: 'string' },
                target_type: { type: 'string', enum: ["service", "package"] },
                condition_field: { type: 'string', description: "UUID: requirement_config_id or concept_id" },
                condition_operator: { type: 'string', enum: [">", "<", ">=", "<=", "=="] },
                condition_value: { type: 'number' },
                action_type: { type: 'string', enum: ["discount", "surcharge"] },
                action_mode: { type: 'string', enum: ["percentage", "fixed"] },
                action_value: { type: 'number' },
                action_value_type: { type: 'string', enum: ["final_price"] },
                priority: { type: 'number' }
              },
              // Logic: There are 11 keys above, so there must be exactly 11 keys here.
              required: [
                "name",
                "condition_name",
                "target_type",
                "condition_field",
                "condition_operator",
                "condition_value",
                "action_type",
                "action_mode",
                "action_value",
                "action_value_type",
                "priority"
              ]
            }
          }
        },
        required: ["suggestions"]
      }
    };

    const prompt = `
    TASK: Suggest 6-10 pricing rules.
    
    LOGIC GUIDELINES BY PRICING MODEL:
  1. "per_person": The 'condition_value' represents the number of GUESTS (e.g., > 100 people).
  2. "per_hour": The 'condition_value' represents DURATION (e.g., > 4 hours).
  3. "per_kg": The 'condition_value' represents WEIGHT (e.g., > 10 kg).
  4. "per_month": The 'condition_value' represents TIME (e.g., > 3 months).
  5. "fixed": 
     - Since the quantity is always 1, DO NOT use the service quantity as a condition.
     - Instead, suggest a discount/surcharge based on the presence of the service (condition_operator: '==', condition_value: 1).
     - OR, suggest a rule where if this service is selected AND the total event value is high (use a generic high number for value).

    DATA CONTEXT:
    - Services: ${JSON.stringify(requirementConfigs.map(r => ({ id: r.id, label: r.label, pricing_model: r.pricing_model })))}
    - Packages: ${JSON.stringify(concepts.map(c => ({ id: c.id, name: c.name })))}

    STRICT MAPPING:
    1. If target_type is 'package':
       - condition_field MUST be the Concept 'id' (UUID).
       - condition_name MUST be the Concept 'name'.
    2. If target_type is 'service':
       - condition_field MUST be the Service 'id' (UUID).
       - condition_name MUST be the Service 'label'.
       - LOGIC: Use 'pricing_model' to ensure conditions are logical (e.g., Guest Count > 100).
    3. action_mode: Use 'percentage' or 'fixed'.
    4. action_value_type: Use 'final_price'.
  `;

    return this.callGenAIWithConfig(prompt, generationConfig);
  }

  async suggestEmailTemplete(tenantId) {
    const requirementConfigs = await leadRequirementConfigRepo.findByTenantAndActive(tenantId);
    console.log("Re:: " + JSON.stringify(requirementConfigs));
    const concepts = await conceptRepo.findAll(tenantId);
    console.log("Conc : " + JSON.stringify(concepts))
    const pricingRules = await pricngRuleRepo.findAll(tenantId);
    console.log("Pric: " + JSON.stringify(pricingRules))
    const placeholders = await placeholderRepo.findByTenant(tenantId);
    console.log("pla:: " + JSON.stringify(placeholders))
    // Formatting placeholders for the AI to use correctly
    const formattedKeys = placeholders.map(p => {
      let key = p.placeholder_key || "";
      return key.startsWith("[") ? key : `[${key}]`;
    });

    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                subject: { type: 'string' },
                body_text: { type: 'string' }, // Plain text fallback
                description: { type: 'string' },
                content_format: { type: 'string' }
              },
              required: ["name", "subject", "body_text", "description", "content_format"]
            }
          }
        },
        required: ["suggestions"]
      }
    };

    const prompt = `
    You are an elite Business Strategist. Generate 8 sophisticated email templates for sending event quotations.
    
    BUSINESS CONTEXT:
    - Services: ${JSON.stringify(requirementConfigs.map(r => r.label))}
    - Concepts: ${JSON.stringify(concepts.map(c => c.name))}
    - Pricing Logic: ${JSON.stringify(pricingRules.map(p => p.name))}
    - Available Placeholders: ${JSON.stringify(formattedKeys)}

    HTML DESIGN REQUIREMENTS:
    - Use clean, modern Inline CSS (tables for layout to ensure email client compatibility).
    - Include a sophisticated Header (centered company placeholder).
    - Use professional typography (sans-serif).
    - Include a clear Footer with signature placeholders and "Confidentiality Notice".
    - Design a clear "View Quotation" call-to-action area (even if just a styled text block).

    TEMPLATE TYPES:
    1. Initial Proposal Delivery (High-end luxury feel).
    2. Executive Corporate Quote (Concise, ROI-focused).
    3. Follow-up with Discount (Highlighting a specific pricing rule).
    4. Re-engagement (For leads that went cold).

    Rule : 
    1. content_format should be 'plain_text'. only

    CRITICAL: Placeholders MUST be used in [bracket_format]. Ensure the tone is prestigious.
  `;

    // return this.callGenAIWithConfig(prompt, generationConfig);

    return { "suggestions": [{ "name": "Event Proposal - [lead_company] - Luxury Tier", "subject": "An Exclusive Vision for Your Product Launch Event - Proposal Enclosed", "body_text": "Subject: An Exclusive Vision for Your Product Launch Event - Proposal Enclosed\n\nDear [lead_name],\n\nWe trust this message finds you well. Following our insightful discussions, [company_name] is honored to present a bespoke proposal tailored to transcend your aspirations for a truly exceptional Product Launch Event.\n\nOur team has meticulously crafted an experience that integrates unparalleled Venue elegance, cutting-edge Production, and sophisticated Branding to create an Immersive Brand Activation. This proposal, [quotation_id], reflects our commitment to delivering an event that is not merely executed, but exquisitely curated to leave a lasting legacy.\n\nDiscover the detailed orchestration of your vision by reviewing the comprehensive proposal. We have included an outline of premium services from our Venue selection to the bespoke Stage Setup, ensuring every element resonates with your brand's prestige.\n\nTotal Investment: [currency][final_price]\n\nView Your Exclusive Proposal: [company_website]/quotations/[quotation_id]\n\nThis proposal is valid until [valid_till]. We are eager to discuss this further at your convenience and refine every detail to perfection.\n\nWarmest regards,\n\n[prepared_by]\nBusiness Strategist\n[company_name]\n[company_phone] | [company_email]\n[company_website]\n\nConfidentiality Notice: This document contains proprietary and confidential information. It is intended solely for the use of the individual or entity to whom it is addressed.", "description": "Initial proposal delivery for a high-end luxury event, emphasizing bespoke solutions, elegance, and unparalleled experience. Focuses on Product Launch Event, Venue, Production, Branding, and Immersive Brand Activation.", "content_format": "plain_text" }, { "name": "Executive Quote - [lead_company] - Strategic Corporate Gala", "subject": "Strategic Investment: Your Corporate Gala Dinner - Quotation [quotation_id]", "body_text": "Subject: Strategic Investment: Your Corporate Gala Dinner - Quotation [quotation_id]\n\nDear [lead_name],\n\nAt [company_name], we understand that a Corporate Gala Dinner is a strategic imperative. We are pleased to present our official quotation, [quotation_id], for orchestrating an Elegant Corporate Gala that promises a significant return on investment through impeccable execution and brand enhancement.\n\nThis quotation outlines our comprehensive approach, encompassing meticulous Catering, sophisticated Stage Setup, and seamless Production to ensure a flawless experience.\n\nKey Details:\nQuotation ID: [quotation_id]\nQuotation Date: [quotation_date]\nValid Till: [valid_till]\nTotal Base Investment: [currency][total_base_price]\nFinal Strategic Investment: [currency][final_price]\n\nAccess Your Executive Quotation: [company_website]/quotations/[quotation_id]\n\nWe are confident that this meticulously planned event will significantly elevate your corporate standing. Please do not hesitate to reach out to [prepared_by] directly to discuss any aspect of this proposal.\n\nSincerely,\n\n[prepared_by]\nSenior Strategist\n[company_name]\n[company_address]\n[company_phone] | [company_email]\n[linkedin_url]\n\nConfidentiality Notice: The contents of this quotation are proprietary and confidential.", "description": "Concise, ROI-focused quote for a corporate client, highlighting strategic benefits, efficiency, and value for an Elegant Corporate Gala.", "content_format": "plain_text" }, { "name": "Special Offer - [lead_company] - IMPACT Pricing", "subject": "Enhancing Your Dynamic Product Launch: Exclusive 'IMPACT' Pricing for [lead_company]", "body_text": "Subject: Enhancing Your Dynamic Product Launch: Exclusive 'IMPACT' Pricing for [lead_company]\n\nDear [lead_name],\n\nFollowing our previous correspondence regarding your Dynamic Product Launch, [company_name] is excited to present a special enhancement to your proposed investment.\n\nTo ensure your event achieves maximum reach and unforgettable impact, we are pleased to offer our exclusive 'IMPACT' pricing structure. This special incentive reflects a [currency][total_discount] saving, designed to provide unparalleled value without compromising on the bespoke quality you expect.\n\nOriginal Investment: [currency][total_base_price]\nSpecial 'IMPACT' Investment: [currency][final_price]\n\nThis revised quotation, [quotation_id], dated [quotation_date], includes our comprehensive Venue, Production, and Branding services, now with the added benefit of our 'IMPACT' pricing.\n\nReview Your Updated Quotation: [company_website]/quotations/[quotation_id]\n\nThis exceptional offer is valid for a limited period, until [valid_till]. We encourage you to seize this opportunity to elevate your Dynamic Product Launch.\n\nBest regards,\n\n[prepared_by]\nClient Relations\n[company_name]\n[company_phone]\n[company_website]\n\nConfidentiality Notice: This information is confidential and intended for the recipient only.", "description": "Follow-up email introducing a special discount using the 'IMPACT' pricing logic, aimed at re-engaging the client with a value proposition for a Dynamic Product Launch.", "content_format": "plain_text" }, { "name": "Re-engagement - [lead_company] - Revitalize Your Product Launch Event", "subject": "Revisiting Your Vision for a Product Launch Event at [lead_company] - A Fresh Perspective", "body_text": "Subject: Revisiting Your Vision for a Product Launch Event at [lead_company] - A Fresh Perspective\n\nDear [lead_name],\n\nWe hope this email finds you well. It has been some time since our last communication regarding your envisioned Product Launch Event.\n\nAt [company_name], we remain enthusiastic about the potential to create a truly spectacular and impactful event for [lead_company]. We understand that priorities can shift, and we wanted to check in to see if your plans for a Product Launch Event are moving forward.\n\nPerhaps there are new insights or evolving objectives we could incorporate into our original proposal, [quotation_id], dated [quotation_date]? We are adept at offering flexible solutions and fresh perspectives, ensuring your event truly stands out.\n\nWe would be delighted to schedule a brief call at your convenience to discuss how we can revitalize your plans or address any new requirements you might have. Our expertise in Venue, Production, and Branding for Product Launch Events remains at your disposal.\n\nKindly respond to this email or reach out to [prepared_by] at [company_phone] to reconnect.\n\nSincerely,\n\n[prepared_by]\nStrategic Partnerships\n[company_name]\n[company_email]\n[company_website]\n\nConfidentiality Notice: Your previous discussions and any shared information remain confidential.", "description": "Re-engagement email for a cold lead, reiterating interest, offering new insights, and flexible options for their Product Launch Event, inviting further discussion.", "content_format": "plain_text" }, { "name": "Event Proposal - [lead_company] - Visionary Immersive Brand Activation", "subject": "Crafting an Unforgettable Immersive Brand Activation Experience for [lead_company]", "body_text": "Subject: Crafting an Unforgettable Immersive Brand Activation Experience for [lead_company]\n\nDear [lead_name],\n\nGreetings from [company_name]. We are thrilled to present our visionary proposal for your Immersive Brand Activation, a concept designed to captivate your audience and elevate your brand presence.\n\nOur expertise in bespoke Production, innovative Branding strategies, and seamless Stage Setup allows us to transform your vision into an extraordinary reality. This comprehensive proposal, [quotation_id], outlines a meticulously planned event that promises an unparalleled interactive experience.\n\nWe have carefully considered every detail, from the conceptual design to the logistical execution, ensuring a flawless and impactful activation that resonates with your target demographic.\n\nTotal Investment for this Visionary Activation: [currency][final_price]\n\nExplore Your Detailed Proposal: [company_website]/quotations/[quotation_id]\n\nThis proposal is valid until [valid_till]. We look forward to partnering with you to bring this ambitious project to life and achieve remarkable success.\n\nBest regards,\n\n[prepared_by]\nChief Event Architect\n[company_name]\n[company_phone] | [company_email]\n[instagram_url]\n\nConfidentiality Notice: This proposal contains proprietary information. Redistribution is prohibited without express written consent from [company_name].", "description": "Second initial proposal, tailored for an Immersive Brand Activation, emphasizing comprehensive event execution, visionary approach, Production, Branding, and Stage Setup.", "content_format": "plain_text" }, { "name": "Executive Quote - [lead_company] - Optimized Corporate Gala", "subject": "Your Investment in Excellence: Corporate Gala Dinner Quotation for [lead_company]", "body_text": "Subject: Your Investment in Excellence: Corporate Gala Dinner Quotation for [lead_company]\n\nDear [lead_name],\n\nIn pursuit of optimizing your next Corporate Gala Dinner, [company_name] is pleased to forward our official quotation, [quotation_id], dated [quotation_date]. Our aim is to ensure a seamless, high-impact event that reinforces your corporate prestige with measurable outcomes.\n\nThis quotation encompasses our refined services including bespoke Catering, sophisticated Venue selection, and expert Production oversight, guaranteeing an event of unparalleled distinction and efficiency.\n\nQuotation Reference: [quotation_id]\nValid Through: [valid_till]\nOptimized Investment: [currency][final_price]\n\nView Your Optimized Quotation: [company_website]/quotations/[quotation_id]\n\nWe are committed to delivering an exceptional experience that aligns perfectly with your objectives and budget. [prepared_by] is available to address any inquiries you may have.\n\nWith distinction,\n\n[prepared_by]\nHead of Corporate Events\n[company_name]\n[company_address]\n[company_phone] | [company_email]\n[linkedin_url]\n\nConfidentiality Notice: This document and its contents are confidential and proprietary to [company_name].", "description": "Alternative executive corporate quote, highlighting optimization and seamless execution for a Corporate Gala Dinner, focusing on Catering, Venue, and Production.", "content_format": "plain_text" }, { "name": "Exclusive Offer - [lead_company] - Growth Incentive", "subject": "Unlocking Greater Value: Our 'Growth' Incentive for Your Product Launch Event", "body_text": "Subject: Unlocking Greater Value: Our 'Growth' Incentive for Your Product Launch Event\n\nDear [lead_name],\n\nAs a testament to our commitment to fostering lasting partnerships, [company_name] is delighted to extend a special 'Growth' incentive for your upcoming Product Launch Event.\n\nWe believe in empowering your growth, and this revised quotation, [quotation_id], includes a significant [currency][total_discount] reduction, bringing your total investment to [currency][final_price]. This exclusive 'Growth' pricing is designed to maximize the impact of your event while optimizing your budget.\n\nOriginal Proposal Value: [currency][total_base_price]\nNew 'Growth' Incentive Price: [currency][final_price]\n\nThis offer is an ideal opportunity to leverage our comprehensive services, including Venue, Production, and Branding, ensuring your Product Launch Event sets a new benchmark for success.\n\nAccess Your Updated Quotation with 'Growth' Incentive: [company_website]/quotations/[quotation_id]\n\nThis special 'Growth' offer is valid until [valid_till]. Please contact [prepared_by] at [company_phone] to move forward.\n\nSincerely,\n\n[prepared_by]\nPartnership Director\n[company_name]\n[company_email]\n[company_website]\n\nConfidentiality Notice: This pricing incentive is confidential and exclusively offered to [lead_company].", "description": "Follow-up email introducing a 'Growth' pricing incentive, designed to build long-term partnerships and unlock greater value for a Product Launch Event.", "content_format": "plain_text" }, { "name": "Checking In - [lead_company] - Your Event Aspirations", "subject": "Following Up on Your Vision: Corporate Gala Dinner Opportunities for [lead_company]", "body_text": "Subject: Following Up on Your Vision: Corporate Gala Dinner Opportunities for [lead_company]\n\nDear [lead_name],\n\nHope you are having a productive week. We are reaching out from [company_name] to follow up on our previous discussions regarding your aspirations for a Corporate Gala Dinner.\n\nWe understand that planning such a pivotal event requires careful consideration, and we wanted to gently check in and see if your plans for a Corporate Gala Dinner are progressing. Our team remains prepared and eager to support your vision with our expertise in Venue selection, exquisite Catering, and flawless Stage Setup.\n\nWe'd be pleased to review our initial thoughts or quotation, [quotation_id], if there are any new elements or requirements you'd like to explore. Your success remains our priority.\n\nPlease feel free to reply to this email or contact [prepared_by] directly at [company_phone] at your convenience. We are here to assist you in making your next corporate event truly exceptional.\n\nWarmly,\n\n[prepared_by]\nEvent Consultant\n[company_name]\n[company_address]\n[facebook_url] | [linkedin_url]\n\nConfidentiality Notice: All previous communications and shared details are treated with the utmost confidentiality.", "description": "Softer re-engagement approach, offering assistance and reminding the client of their Corporate Gala Dinner aspirations without pressure, for a lead that went cold.", "content_format": "plain_text" }] };
  }

  async generateFollowUpEmailContent(lastMessage, tenantDetails, leadDetails) {
    // 2. Call AI Model
    const finalPrompt = `
      You are an expert sales and customer relations assistant for ${tenantDetails.name}. 
      RECIPIENT (The Client):
      - Name: ${leadDetails.first_name + " " + leadDetails.last_name || 'Valued Client'}
      - Company: ${leadDetails.company || 'Not Specified'}

      SENDER (Your Identity):
      - Company Name: ${tenantDetails.name}
      - Your Email: ${tenantDetails.email}
      - Your Website: ${tenantDetails.website}
      - Your Phone: ${tenantDetails.phone}

      CORE RULE: 
              The email is FROM ${tenantDetails.name} TO ${leadDetails.first_name + " " + leadDetails.last_name || 'Valued Client'}. 
              DO NOT address the email to "${tenantDetails.name}".
              START the email with "Dear ${leadDetails.first_name + " " + leadDetails.last_name || 'Valued Client'}," or "Hi ${leadDetails.first_name + " " + leadDetails.last_name || 'Valued Client'},".
                  The client (${leadDetails.first_name + " " + leadDetails.last_name || 'Valued Client'}) recently sent this message:
              "${lastMessage}"

              Based on their message, draft a warm, professional follow-up. 
              Include our contact details (${tenantDetails.email} / ${tenantDetails.phone}) 
                          and invite them to check our website: ${tenantDetails.website}.
      TASK:
      Draft a professional, warm, and proactive follow-up email. 

      CRITICAL RULES:
1. START the email with: "Dear ${leadDetails.first_name + " " + leadDetails.last_name || 'Valued Client'}," or "Hi ${leadDetails.first_name + " " + leadDetails.last_name || 'Valued Client'},".
3. End the email by signing off as "${tenantDetails.name}".
4. Mention that they can visit your website ${tenantDetails.website} or email ${tenantDetails.email} for more info.

      OUTPUT FORMAT:
      Return ONLY a JSON object with exactly two keys:
      {
        "subject": "...",
        "body": "..."
      }
    `;

    const aiResponse = await this.callGenAI(finalPrompt);

    // --- FIX STARTS HERE ---
    // Remove markdown code blocks (```json or ```) and any leading/trailing whitespace
    const cleanJsonString = aiResponse
      .replace(/```json/g, '') // Remove ```json
      .replace(/```/g, '')     // Remove ```
      .trim();                 // Remove extra spaces

    try {
      const result = JSON.parse(cleanJsonString);

      // Format line breaks for ReactQuill
      const formattedBody = result.body.replace(/\n/g, '<br />');

      return {
        subject: result.subject,
        body: formattedBody
      };
    } catch (parseError) {
      console.error("Failed to parse AI JSON. Raw response was:", aiResponse);
      throw new Error("AI returned invalid JSON format");
    }
  }

  async generateEmailMessagesCrux(messages, tenantDetails, leadDetails) {
    const prompt = `You are an expert executive assistant for ${tenantDetails.name}.
Below is a conversation history with a client named ${leadDetails.first_name + " " + leadDetails.last_name || 'Valued Client'}.

CONVERSATION:
${messages.map(msg => `- ${msg.sender_type === 'lead' ? 'Client' : 'You'}: ${msg.body_html}`).join('\n')}

TASK:
Provide a "Crux" (executive summary) of this conversation using the following strict structure:
1. Core Objective: Summarize what the lead is seeking.
2. Key Requirements: List logistical details established or missing (date, guest count, budget).
3. Current Status: Define the current stage of the inquiry and the immediate next step needed.

Use a professional and helpful tone.

FORMAT:
Return ONLY a JSON object where the value is a single string formatted with markdown bullets and bold headers exactly like this:
{ 
  "crux": "Here is the crux of the conversation:\n\n* **Core Objective:** [Details here]\n* **Key Requirements:** [Details here]\n* **Current Status:** [Details here]" 
}`;
    console.log(prompt)
    const aiResponse = await this.callGenAI(prompt);
    const cleanJson = aiResponse.replace(/```json|```/g, "").trim();
    const result = JSON.parse(cleanJson);

    // Format newlines for display
    return result.crux.replace(/\n/g, '<br />');
  }
}


module.exports = new AIService();
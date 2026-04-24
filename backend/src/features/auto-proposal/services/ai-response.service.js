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
const { Storage } = require("@google-cloud/storage");
const { uploadBufferToGCS } = require('../../../utils/gcsUploader');
const storage = new Storage({
  keyFilename: process.env.GCS_KEY_FILE, // service-account.json
});

const ImageModule = require("docxtemplater-image-module-free");
const convertAsync = promisify(libre.convert);
const sizeOf = require("image-size"); // npm install image-size

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
    You are an expert Data Extraction and Service Matching AI. 
    Your goal is to extract structured details from a lead's email and ensure every requested service has a valid numeric quantity so a quotation can be generated.

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

    ### REQUIRED JSON STRUCTURE:
    {
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

  async fetchAIResponse(prompt) {
    const modelInfo = this.getNextApiKey();
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

  async generateQuotationProposal(data, leadDetails, event_type, tenantDetails) {
    try {
      let fileName = `quotation - ${uuidv4()}.pdf`;
      fileName = `proposals/${fileName}`; // Add proposals/ prefix here
      const localPath = path.join(__dirname, "../", fileName);

      // 1. Launch Puppeteer
      const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox']
      });
      let result = null;
      // await this.generateDirectPdfFromDocx(tenantDetails.id, leadDetails, data, fileName, localPath);
      if (result === null) {
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
      }

      // 4. Upload to GCS (Existing logic)
      const gcsUrl = await uploadToGCS(localPath, fileName);
      console.log("Generated PDF GCS URL:", gcsUrl);
      return { gcsUrl, fileName };
    } catch (err) {
      console.error("PDF Generation Failed:", err);
      throw err;
    }
  }


  async generateProposalFromTemplate(data, tenantId) {
    // 1. Fetch the default template path from your metadata table
    const templateMetadata = await templateRepository.findDefaultByTenant(tenantId);
    if (!templateMetadata) return null; // Handle case where no template is found for the tenant
    let fileName = `quotation - ${uuidv4()}.pdf`;
    fileName = `proposals/${fileName}`; // Add proposals/ prefix here
    const localPath = path.join(__dirname, "../", fileName);


    try {

      let result = await this.generateDirectPdfFromDocx(tenantId, localPath, fileName, data);
      if (result === null) {
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
      } else {
        return result;
      }

    } catch (err) {
      console.error("PDF Generation Failed:", err);
      throw err;
    }
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
        getSize: () => {return [100, 40]; // Fallback to a default size
        },
      };
      // 2. Initialize Docxtemplater with the Image Module
      const imageModule = new ImageModule(imageOptions);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        modules: [imageModule],
        delimiters: { start: "[", end: "]" }
      });
      // const doc = new Docxtemplater(zip, {

      //   // Add this if the client uses [placeholder] instead of {placeholder}
      //   delimiters: {
      //     start: "[",
      //     end: "]",
      //   }
      // });

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
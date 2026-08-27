const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require("crypto");
const path = require("path");
const { generatePDF } = require("../../../utils/pdfGenerator");
const { uploadToGCS } = require("../../../utils/gcsUploader");
const logger = require("../../../utils/logger");
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
const mammoth = require("mammoth");
const { Storage } = require("@google-cloud/storage");
const { uploadBufferToGCS } = require('../../../utils/gcsUploader');
const storage = new Storage({
  keyFilename: process.env.GCS_KEY_FILE, // service-account.json
});

const ImageModule = require("docxtemplater-image-module-free");
const convertAsync = promisify(libre.convert);
const conversationMessageRepository = require("../repositories/conversation-message.repository");
const tenantRepository = require("../repositories/tenant.repository");
const tenantProfileRepository = require("../repositories/tenant-profile.repository");
const pricingModelRepository = require("../repositories/pricingModel.repository");
const pricingRuleRepository = require("../repositories/pricingRule.repository");

class AIService {
  constructor() {
    this.geminiModels = [];
    this.currentApiKeyIndex = 0;
    this.isConfigured = false;
    this.setupGeminiAPI();
  }

  setupGeminiAPI() {
    this.geminiModels = [];
    this.currentApiKeyIndex = 0;
    this.isConfigured = false;
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
        logger.warn("⚠️ No valid Gemini API keys found. AI service running in unconfigured mode.");
        return;
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
          console.warn(`❌ Error setting up key ${index + 1}:`, err.message);
        }
      });

      this.isConfigured = this.geminiModels.length > 0;
      if (!this.isConfigured) {
        console.warn("⚠️ No Gemini models could be configured. AI service running in unconfigured mode.");
      } else {
        console.log(
          `🎯 Total Gemini API keys configured: ${this.geminiModels.length}`
        );
      }
    } catch (err) {
      console.warn("⚠️ Gemini setup warning:", err.message);
      this.isConfigured = false;
    }
  }

  ensureConfigured() {
    if (!this.isConfigured || !this.geminiModels || !this.geminiModels.length) {
      const error = new Error("AI service is not configured with valid API keys");
      error.statusCode = 503;
      throw error;
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
    this.ensureConfigured();
    let retries = Math.max(1, this.geminiModels.length * 2); // Allow enough retries to try all keys twice if needed

    for (let i = 0; i < retries; i++) {
      // ✅ Fetch a fresh key inside the loop so we rotate on failure
      const modelInfo = this.getNextApiKey();

      if (!modelInfo) {
        const error = new Error("AI service is not configured with valid API keys");
        error.statusCode = 503;
        throw error;
      }

      console.log(`[Attempt ${i + 1}] Using Gemini API Key Index: ${modelInfo.keyIndex}`);

      try {
        const model = modelInfo.client.getGenerativeModel({
          model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        });

        console.log("Sending request to Gemini...");
        const result = await model.generateContent(prompt);
        const response = await result.response;

        // Update statistics on successful call
        this.updateUsage(modelInfo);
        console.log(`✅ Response fetched from Gen AI successfully using Key Index: ${modelInfo.keyIndex}`);

        return response.text();

      } catch (err) {
        const errorMessage = err.message || "";
        console.error(`❌ Error with Key Index ${modelInfo.keyIndex}:`, errorMessage);

        // Check for Rate Limit (429), Quota Exhausted, or Service Unavailable (503)
        const isRateLimit = errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota");
        const isServiceUnavailable = errorMessage.includes("503");

        if ((isRateLimit || isServiceUnavailable) && i < retries - 1) {
          console.warn(`⚠️ Key Index ${modelInfo.keyIndex} rate-limited or unavailable. Rotating immediately to the next key...`);

          // Optional: Add a short backoff pause only if it's a transient 503 server error
          if (isServiceUnavailable) {
            await new Promise((res) => setTimeout(res, 20000));
          }
          console.log(`🔄 Rotating to the next Gemini API key due to error on index ${modelInfo.keyIndex}. Retrying... (Attempt ${i + 2} of ${retries})`);
          // Continue loop: loop restarts, picks up the NEXT key index via this.getNextApiKey()
          continue;
        } else {
          // If it's a completely different error (like bad prompt or auth), throw it immediately
          throw err;
        }
      }
    }

    throw new Error("All configured Gemini API keys exhausted or rate-limited.");
  }

  async callGenAIWithConfig(prompt, generationConfig) {
    this.ensureConfigured();

    const modelInfo = this.getNextApiKey();
    logger.debug(
      "Using Gemini API Key Index:",
      modelInfo ? modelInfo.keyIndex : "None"
    );
    if (!modelInfo) {
      const error = new Error("AI service is not configured with valid API keys");
      error.statusCode = 503;
      throw error;
    }

    // ✅ Correct SDK usage

    const model = modelInfo.client.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      generationConfig,
    });

    let retries = 3;
    for (let i = 0; i < retries; i++) {
      try {
        logger.debug("send request to gemini");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        this.updateUsage(modelInfo);
        logger.debug(`Response fetched from gen AI after attempt : ${i}`);
        const resp = JSON.parse(response.text());
        logger.debug("REsponse:: " + JSON.stringify(resp));
        return resp;
      } catch (err) {
        if (err.message && err.message.includes("503") && i < retries - 1) {
          logger.debug(`Retrying... attempt ${i + 1}`);
          await new Promise((res) => setTimeout(res, 2000));
        } else {
          throw err;
        }
      }
    }
  }

  async generateAIResponse(emailContent, tenant_id, conversation_id, leadData, global_message_id,configs) {
    try {
      const tenantDetails = await tenantRepository.findById(tenant_id);
      const rawHistory = await conversationMessageRepository.findTop10EmailByTenantIdAndConversationId(tenant_id, conversation_id, global_message_id);
      const lastMessageWithDraft = rawHistory.find(m => m.proposal_draft_id !== null);
      const pricingRules = await pricingRuleRepository.findAllWithConceptAndServiceDetails(tenant_id);
      const structuredPricingRulesPrompt = JSON.stringify(pricingRules, null, 2);
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
      
      const services_provided = configs.map(c => c.label).join(', ');
      // Create a detailed map for the AI
      // const dynamicFieldsPrompt = configs.map(c =>
      //   `- ${c.field_key}: (${c.label})`
      // ).join('\n');
      console.log("services_provided:: " + services_provided);
      const pricingModels = await pricingModelRepository.findAll(tenant_id);
      const dynamicFieldsPrompt = configs
        .map(config => {
          // Find the matching pricing model label (e.g., "Per Person", "Fixed Rate")
          const model = pricingModels.find(m => m.id === config.pricing_model_id);
          const pricingType = model ? model.label : 'Fixed/Flat Rate';

          return `- ${config.field_key}: Description: ${config.label} (Pricing Structure: ${pricingType})`;
        })
        .join('\n');
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
      const currentDateString = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const prompt = `
    You are an expert Data Extraction and Service Matching AI. 
    Your goal is to extract structured details from a lead's email and ensure every requested service has a valid numeric quantity so a quotation can be generated when appropriate.

    ### SYSTEM TIMELINE CONTEXT (CRITICAL):
    - Today's Reference Date is: ${currentDateString} (Use this exact baseline year to evaluate if client dates are valid or have passed).

    ### SENDER IDENTITY (MANDATORY FOR TEXT_REPLY):
    - Company Name: ${tenantDetails.name}
    - Company Email: ${tenantDetails.email || 'Not Specified'}
    - Company Website: ${tenantDetails.website || 'Not Specified'}
    
    ### CONVERSATION HISTORY (FOR CONTEXT):
    ${formattedHistory}

    ### CUSTOM SCHEMA FIELDS (MANDATORY):
    ${dynamicFieldsPrompt}

    ### ACTIVE AVAILABLE PRICING RULES DATA SCHEMAS:
    ${structuredPricingRulesPrompt}

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
    1. **NO ZERO OR TEXT QUANTITIES**: For every key in "dynamic_requirements", you must return ONLY a Number or null. Never return text descriptions inside numeric fields.
    2. **MANDATORY MINIMUM QUANTITY**: If a lead requests a service but does not specify a quantity, you MUST assign a value of **1**. This ensures the total price is never zero.
    3. **INTELLIGENT SERVICE MATCHING**: If the lead's demand is clear but they don't list specific sub-services, check the CUSTOM SCHEMA and enable the service keys that are logically required.
    4. **SPECIFIC COUNT EXTRACTION**: If the email mentions a specific number (e.g., "100 guests"), extract ONLY that number for the corresponding key.
    5. **CRITICAL GUEST COUNT CROSS-DEPENDENCY**: If the email specifies a guest count (e.g., "200 guests"), that exact number MUST scale and apply to ALL requested services that are dependent on or provided per person, such as catering/plates.
    6. **NULL FOR UNRELATED**: Return null ONLY for services that are completely unrelated to the lead's email content.
    7. **NO BOOLEANS**: Do not use "yes", "no", or "true". Use numbers only.
    8. **FORMATTING**: Return ONLY raw valid JSON. No markdown, no backticks, no explanations.
    9. **NO SERVICE HALLUCINATIONS (BUG 2 Fix)**: You must ONLY refer to services that are explicitly listed in the Whitelist: [${conceptNames}]. Never infer, extrapolate, or name services that are not in this list (e.g., Do NOT invent names like "Main Event Lite" or "Corporate Workshop").
    10. **NO RAW MARKDOWN (BUG 9 Fix)**: Never use markdown formatting like asterisks (**text**) or hashes (#) in the "text_reply". Use plain, clean text formatting only.
    11. **NO PROACTIVE CATALOG DUMPING (BUG 4 Fix)**: Never list available services, packages, or pricing structure models unless the lead has explicitly asked "what services do you offer" or similar. Keep early dialogue tightly focused on what they asked.
    
    ### AUTOMATED STEP-BY-STEP PROCESSING PIPELINE:

      #### STEP 1: SENTIMENT DETECTION (BUG 11 Fix)
      - Analyze the email for negative/angry sentiment (e.g., "unprofessional", "delayed response", frustration).
      - If negative sentiment is detected, you MUST begin your "text_reply" with a profound, sincere personal apology addressing their complaint directly before taking any other action.

      #### STEP 2: UNANSWERED QUESTION EXTRACTION (BUG 8 Fix)
      - Scan the lead's current email and compile an internal list of all direct or indirect questions asked (e.g., "Is pricing negotiable?").
      - You MUST explicitly address and answer each of these questions inside your "text_reply", or state that you will have the team follow up on that specific topic. Never drop an active question.

      #### STEP 4: 4-STATE INTENT CLASSIFICATION (BUG 1 Fix)
        You must classify the "intent" into exactly one of these 4 states based on the priority matrix rules below:
        
        - State 1: "GREETING" -> If the email is just a basic greeting, hello, or sign-in opening. 
          * Action: Set intent to "GREETING". Write a brief, friendly, conversational welcome response. Do not dump your catalog. 
          * Action : Start with "Hi ${leadData.first_name || 'Valued Client'},". Do not dump your catalog.
          
- State 2: "SERVICE_INQUIRY" -> If the lead is asking general exploratory questions, or explicitly asks a structural query like "share me the packages" to understand available options.
          * CRITICAL RESTRICTION: If the customer is completely missing BOTH a guest count and service choices (e.g., "I'd like to know more about what you offer"), you MUST NOT use the package exposure strategy below. Instead, let STEP 6 override the text_reply with the data gathering template.
          * Package & Pricing Rules Exposure Strategy (CRITICAL):
            1. IF there are entries present inside the "concepts" array:
               List each package concept by its "concept_name". Under each package name, print its associated "pricing_rules" details in clean, natural language sentences.
            2. IF the "concepts" array is empty, fall back entirely to the "standaloneRequirements" array:
               List the available core services by their "service_label" and cleanly explain their active rules using the same natural, non-technical sentence structure.
          * Rule: Do not execute a live calculation, do not build a custom quote grid table, and do not show raw database syntax terms like 'uuid' or 'target_type' to the client. Keep it conversational.
               
        - State 3: "QUOTE_REQUEST" -> If and only if the lead is actively asking for a concrete financial estimate, has provided actionable specifications (date, counts), has a valid future date, and has never received a quote in the conversation history thread.
          * Action: Set intent to "QUOTE_REQUEST". Set text_reply to null (letting backend code take over).
          * Action : Start with "Hi ${leadData.first_name || 'Valued Client'},"
          
        - State 4: "BOOKING_CONFIRMATION" -> If the lead uses confirmation milestones like "go ahead", "confirm", "book", "advance payment", or "next steps".
          * Action: Set intent to "BOOKING_CONFIRMATION". Set text_reply exactly to: "Thank you for confirming! We're excited to work with you. Our team will reach out to you shortly with the advance payment details and booking formalities."
          * Action : Start with "Hi ${leadData.first_name || 'Valued Client'},"
        
        - State 5: "BUDGET_REQUEST" -> If the customer specifies clear service parameters/selections and asks how it looks "budget-wise", asks for a quote regarding their budget, or provides an expected cost limit.
          * Action: Force intent to "BUDGET_REQUEST". Populate text_reply using the specific attached-proposal greeting block template.
          * Action : Start with "Hi ${leadData.first_name || 'Valued Client'},"
        
        - State 6: "RETURNING_CLIENT_QUOTE" -> Triggered strictly when a returning customer with an established past real-world relationship re-connects warmly AND provides complete specifications (guest count + services requested) to request a new pricing proposal.
          * Action: Force intent to "RETURNING_CLIENT_QUOTE". You MUST generate a warm, deeply personalized "text_reply" email body text that acknowledges their past relationship details enthusiastically before telling them their proposal breakdown is attached. Populated requirements will still allow backend attachment generation.


    ### DECISION LOGIC & GATEKEEPERS (EVALUATE STRICTLY IN ORDER):

    1. STEP 1: DYNAMIC GREETING PATTERN
       - Whenever you construct a "text_reply", you must explicitly start the message with a greeting addressed to the lead, formatted exactly as: "Hi ${leadData.first_name || 'Valued Client'},"

    2. STEP 2: PAST DATE DETECTION (OVERRIDES ALL QUOTE GENERATION)
       - If the client mentions an event date that is in the PAST relative to today's date (${currentDateString}):
         * Force "intent" to "SERVICE_INQUIRY".
         * Write a polite "text_reply" noting that the specified date has passed, and ask for an updated timeline so you can look up packages. Keep "dynamic_requirements" fields as null. Skip all remaining steps.

    3. STEP 3: UNSTUPPORTED SERVICES CHECK
       - If the lead is explicitly asking for a service that is NOT in your CUSTOM SCHEMA FIELDS (e.g., they ask for "photography" but it's not listed in your system):
         * Force "intent" to "SERVICE_INQUIRY".
         * Set "text_reply" exactly to: 
           "Thank you for reaching out! Unfortunately, [Name of requested unsupported service] isn't a service we currently offer.\\nWe specialize in end-to-end event planning — covering our core offerings like ${conceptNames}. If you're planning an event and need any of these, we'd love to help!\\nFeel free to reach out if there's anything else we can assist with."
         * Keep "dynamic_requirements" fields as null. Skip remaining steps.

    4. STEP 4: BOOKING / CONFIRMATION INTENT DETECTION
       - If the email contains action-oriented confirmation keywords like "go ahead", "confirm", "book", "advance payment", or "next steps":
         * Force "intent" to "BOOKING_CONFIRMATION" (Suppress generating a new quote layout).
         * Set "text_reply" exactly to:
           "Thank you for confirming! We're excited to work with you. Our team will reach out to you shortly with the advance payment details and booking formalities."
         * Skip remaining steps.
    
    5. STEP 5: PRIOR REAL-WORLD RELATIONSHIP INTERCEPTOR (HIGH PRIORITY LOGIC)
       - Scan the incoming email content and history thread for clear indicators of an established past relationship, older successful events organized by you years ago, or warm structural updates (e.g., "event you organised for us two years ago", "team still talks about it", "reconnect").
       - **IF PRIOR RELATIONSHIP DETECTED AND SPECIFICATIONS ARE COMPLETE**:
         * If they provided a guest count AND service parameters (like Chethan's email regarding 150 people for Main Event + Function Hall):
           * Force "intent" to "RETURNING_CLIENT_QUOTE".
           * **DYNAMIC GENERATION RULES**: Write a beautifully custom, warm text email response. You must hit these exact markers:
             1. Greet them warmly by name.
             2. Enthusiastically acknowledge the specific past memory they raised (e.g., "We are absolutely thrilled to hear that the team still talks about the event we organized two years ago!").
             3. Validate their life update text (e.g., "Huge congratulations on the new office and all your new projects!").
             4. Confirm you'd love to organize their upcoming event in August for their 150 guests.
             5. Clearly state that your automated pricing engine has calculated their investment breakdown and attached the official proposal to this message thread for their immediate review.
             6. End with a personal, warm sign-off as ${tenantDetails.name}.
             7. CRITICAL: Never use markdown bolding (**), bullet lists, or hash headers (#) inside "text_reply". Use clean paragraphs separated by double newlines (\\n\\n).
           * Extract and fully populate "dynamic_requirements" using your standard numeric rules so your backend can generate the attached layout files. Skip all remaining steps.
         * **IF PRIOR RELATIONSHIP DETECTED BUT SPECIFICATIONS ARE VAGUE/MISSING**:
           * Force "intent" to "SERVICE_INQUIRY".
           * Generate a personalized message catching up warmly, but guide them to share their numbers/selections before you can dump a rate matrix. Skip remaining steps.
    

    6. STEP 6: HISTORY & DUPLICATE QUOTE CHECK
       - Analyze the ### CONVERSATION HISTORY. If a quotation/proposal breakdown has already been explicitly sent to the client in this thread:
         * Force "intent" to "SERVICE_INQUIRY" (Do not re-trigger a duplicate "QUOTE_REQUEST" workflow or modify the database arrays).
         * Provide a natural "text_reply" addressing any new text questions they had, or ask if they need help finalizing the details. Skip remaining steps.

    7. STEP 7: EXPLORATORY & PREMATURE INQUIRY PROTECTION
       - **MANDATORY DETAILS CHECK (CRITICAL)**: Both a specified guest count (or headcount) AND at least one explicit service from our available offerings must be present to qualify for a quotation or package dump. If the incoming email is completely missing BOTH a guest count and service choices, you MUST treat it as an exploratory data-gathering phase.
       - Force "intent" to "SERVICE_INQUIRY" IF:
         a) It is the FIRST email in the thread AND the customer has NOT included or listed any specific services and guest counts they want (e.g., "how much do you charge?").
         b) The lead asks completely vague questions with no numbers/selections.
       - **CRITICAL OVERRIDE**: If the lead explicitly includes or names specific services they want (e.g., "We need decoration and catering" or "Main Event setup"), SKIP this protection step entirely and proceed down to generation loops.
       - **DYNAMIC REPETITION GUARD**: 
         * **IF FIRST EMAIL INTERACTION WITH NO MANDATORY METRICS**: Use the standard 4-question data gathering template layout block.
         * **IF HARDCODED LIST WAS SENT**: Write a completely unique conversational follow-up response without repeating the questions list layout block.
       - Keep "dynamic_requirements" fields as null. Skip remaining steps.

   8. STEP 8: BUDGET REQUEST DETECTOR (CRITICAL PROPOSAL BYPASS - HIGH PRIORITY INTERCEPT)
       - If the lead shares an expected budget value, a specific target cost metric, asks how an arrangement looks "budget-wise", or explicitly brings up competitor quote metrics while providing a guest count and selecting concrete service options:
         * Force "intent" to "BUDGET_REQUEST".
         * **DYNAMIC TEXT_REPLY GENERATION RULES**: Write a natural, highly custom email response based on their input. You must follow these absolute guidelines:
           1. Start exactly with: "Hi ${leadData.first_name || 'Valued Client'},"
           2. Dynamically reference their unique context: Politely acknowledge the exact budget amount, price targets, or competitive comparisons they mentioned, along with their specified guest count, as extracted strictly from their incoming email.
           3. Maintain price integrity: Gracefully communicate that your pricing structures are aligned with delivering premium menu, setup, and service quality benchmarks, while reassuring them that you always aim to optimize options to align with their event goals.
           4. Clearly state that a tailored pricing/quotation proposal layout has been generated and attached to this email thread for their immediate review.
           5. End with a polite sign-off strictly as ${tenantDetails.name}.
           6. CRITICAL: Never include markdown bolding (**), bullet lists, or hash headers (#). Use clean, plain text with standard double newlines (\\n\\n) between paragraphs.
         * Extract and populate "dynamic_requirements" completely using the details mentioned in the email layout. Skip remaining steps.

    9. STEP 9: QUOTE_REQUEST QUALIFICATION
       - ONLY if the date is in the future (or unspecified yet) and the lead has provided the mandatory details—explicitly stating a guest count AND selecting concrete choices of our services: [${services_provided}]—requesting a price outline:
         * Set "intent" to "QUOTE_REQUEST".
         * Set "text_reply" to null (This forces backend processing code to take over and build the proposal sheet).
         * Populate "dynamic_requirements" completely using your extraction rules.
       
    ### REQUIRED JSON STRUCTURE:
    {
      "intent": "GREETING" | "SERVICE_INQUIRY" | "QUOTE_REQUEST" | "BOOKING_CONFIRMATION" | "BUDGET_REQUEST",
      "text_reply": "Natural email response string matching the step triggered above, else null. Remember to strictly sign off as ${tenantDetails.name} and use clean structural newlines (\\n) between paragraphs.",
      "sentiment_is_negative": true | false,
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
      if (parsed.intent != "QUOTE_REQUEST" && parsed.intent != "BUDGET_REQUEST" && parsed.intent != "RETURNING_CLIENT_QUOTE") {
        return {
          type: "DISCOVERY_EMAIL",
          content: parsed.text_reply,
          lastMessageWithDraft: lastMessageWithDraft
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
        type: parsed.intent,
        data: parsed,
        lastMessageWithDraft: lastMessageWithDraft
      };
    } catch (err) {
      console.error("AI Generation Error:", err);
      throw err;
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
    let fileName = `quotation - ${crypto.randomUUID()}.pdf`;
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
            const res = await fetch(tagValue);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const arrayBuf = await res.arrayBuffer();
            return Buffer.from(arrayBuf);
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
      if (typeof templateData.company_logo === 'string' && templateData.company_logo.trim() !== '') {
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
    this.ensureConfigured();
    logger.debug("tenantId:: " + tenantId);

    const [configs, tenant, profile] = await Promise.all([
      leadRequirementConfigRepo.findByTenantAndActive(tenantId),
      tenantRepository.findById(tenantId),
      tenantProfileRepository.findByTenantId(tenantId)
    ]);

    const servicesText = configs && configs.length > 0
      ? configs.map(c => `- ${c.label} (ID: ${c.id}, Category: ${c.category || 'General'})`).join('\n')
      : 'No predefined service catalog entries.';

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
                description: { type: 'string' },
                minimum_cost: { type: 'number' },
                requirement_configs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' }
                    },
                    required: ["id", "name"]
                  }
                }
              },
              required: ["name", "description", "minimum_cost", "requirement_configs"]
            }
          }
        },
        required: ["suggestions"]
      }
    };

    const prompt = `
You are a senior event strategist and business development consultant for "${tenant?.name || 'our company'}".
${profile?.tagline ? `Company Tagline: ${profile.tagline}` : ''}
${tenant?.website ? `Website: ${tenant.website}` : ''}

Available Service Offerings:
${servicesText}

TASK: Generate 3-5 structured concept tiers (e.g., Lite / Standard / Premium / Luxury Activation) tailored to this business profile.
For each concept tier:
1. "name": Descriptive name of the package / tier.
2. "description": A compelling value proposition for this tier.
3. "minimum_cost": A reasonable minimum cost / base price (number).
4. "requirement_configs": An array of matched service objects from the Available Service Offerings list above, each with "id" (the exact UUID/id from the list) and "name" (the label/name).
`;

    return this.callGenAIWithConfig(prompt, generationConfig);
  }

  async suggestPricingRules(tenantId) {
    this.ensureConfigured();

    const [requirementConfigs, concepts] = await Promise.all([
      leadRequirementConfigRepo.findByTenantAndActive(tenantId),
      conceptRepo.findAll(tenantId)
    ]);

    if ((!requirementConfigs || requirementConfigs.length === 0) && (!concepts || concepts.length === 0)) {
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
                target_type: { type: 'string', enum: ["package", "service"] },
                condition_field: { type: 'string' },
                condition_name: { type: 'string' },
                condition_operator: { type: 'string', enum: [">", "<", ">=", "<=", "=="] },
                condition_value: { type: 'number' },
                action_type: { type: 'string', enum: ["discount", "surcharge"] },
                action_mode: { type: 'string', enum: ["percentage", "fixed"] },
                action_value: { type: 'number' },
                description: { type: 'string' }
              },
              required: [
                "name",
                "target_type",
                "condition_field",
                "condition_name",
                "condition_operator",
                "condition_value",
                "action_type",
                "action_mode",
                "action_value",
                "description"
              ]
            }
          }
        },
        required: ["suggestions"]
      }
    };

    const prompt = `
TASK: Suggest 6-10 schema-compatible dynamic pricing rules.

DATA CONTEXT:
- Services: ${JSON.stringify((requirementConfigs || []).map(r => ({ id: r.id, field_key: r.field_key, label: r.label, pricing_model: r.pricing_model })))}
- Packages / Concepts: ${JSON.stringify((concepts || []).map(c => ({ id: c.id, name: c.name })))}

SCHEMA REQUIREMENTS:
- "name": Concise rule title (e.g., "Bulk Guest Discount", "Peak Rush Surcharge")
- "target_type": "package" or "service"
- "condition_field": The target service field_key/id or concept id
- "condition_name": Human readable label or name of the target service or concept
- "condition_operator": One of ">", "<", ">=", "<=", "=="
- "condition_value": Numeric condition threshold
- "action_type": "discount" or "surcharge"
- "action_mode": "percentage" or "fixed"
- "action_value": Numeric price modifier
- "description": Business rationale for this dynamic rule
`;

    return this.callGenAIWithConfig(prompt, generationConfig);
  }

  async suggestEmailTemplates(tenantId) {
    this.ensureConfigured();

    const [requirementConfigs, concepts, pricingRules, placeholders, tenant, profile] = await Promise.all([
      leadRequirementConfigRepo.findByTenantAndActive(tenantId),
      conceptRepo.findAll(tenantId),
      pricingRuleRepository.findAll(tenantId),
      placeholderRepo.findByTenant(tenantId),
      tenantRepository.findById(tenantId),
      tenantProfileRepository.findByTenantId(tenantId)
    ]);

    const formattedKeys = (placeholders || []).map(p => {
      let key = p.placeholder_key || "";
      return key.startsWith("[") ? key : `[${key}]`;
    });
    const defaultTokens = ["[lead_name]", "[company_name]", "[final_price]", "[quotation_id]", "[valid_till]", "[currency]"];
    const allTokens = Array.from(new Set([...defaultTokens, ...formattedKeys]));

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
                body_html: { type: 'string' },
                body_text: { type: 'string' },
                description: { type: 'string' },
                content_format: { type: 'string' }
              },
              required: ["name", "subject", "body_html", "body_text", "description", "content_format"]
            }
          }
        },
        required: ["suggestions"]
      }
    };

    const prompt = `
You are an elite business communication strategist for "${tenant?.name || 'our company'}".
Generate 4-6 sophisticated quotation and proposal email templates.

BUSINESS CONTEXT:
- Company Name: ${tenant?.name || 'Company'}
- Services: ${JSON.stringify((requirementConfigs || []).map(r => r.label))}
- Concepts: ${JSON.stringify((concepts || []).map(c => c.name))}
- Pricing Rules: ${JSON.stringify((pricingRules || []).map(p => p.name))}
- Available Token Tags: ${JSON.stringify(allTokens)}

TEMPLATE DESIGN REQUIREMENTS:
- MUST include token tags in square bracket format (specifically [lead_name], [company_name], [final_price], [quotation_id], [valid_till]).
- "body_html": Responsive HTML email template with clean inline styling, elegant header, quotation highlight section, call to action, and professional footer with confidentiality notice.
- "body_text": Plain-text equivalent.
- "content_format": Set to "html".
- "description": Usage description of the template (e.g. "Initial Luxury Proposal Delivery", "Follow-up Discount Incentive").
`;

    return this.callGenAIWithConfig(prompt, generationConfig);
  }

  async suggestEmailTemplete(tenantId) {
    return this.suggestEmailTemplates(tenantId);
  }

  async generateFollowUpEmailContent(lastMessage, tenantDetails, leadDetails) {
    const clientName = [leadDetails?.first_name, leadDetails?.last_name].filter(Boolean).join(' ').trim() || 'Valued Client';
    // 2. Call AI Model
    const finalPrompt = `
      You are an expert sales and customer relations assistant for ${tenantDetails.name}. 
      RECIPIENT (The Client):
      - Name: ${clientName}
      - Company: ${leadDetails?.company || 'Not Specified'}

      SENDER (Your Identity):
      - Company Name: ${tenantDetails.name}
      - Your Email: ${tenantDetails.email}
      - Your Website: ${tenantDetails.website}
      - Your Phone: ${tenantDetails.phone}

      CORE RULE: 
              The email is FROM ${tenantDetails.name} TO ${clientName}. 
              DO NOT address the email to "${tenantDetails.name}".
              START the email with "Dear ${clientName}," or "Hi ${clientName},".
                  The client (${clientName}) recently sent this message:
              "${lastMessage}"

              Based on their message, draft a warm, professional follow-up. 
              Include our contact details (${tenantDetails.email} / ${tenantDetails.phone}) 
                          and invite them to check our website: ${tenantDetails.website}.
      TASK:
      Draft a professional, warm, and proactive follow-up email. 

      CRITICAL RULES:
1. START the email with: "Dear ${clientName}," or "Hi ${clientName},".
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
    const clientName = [leadDetails?.first_name, leadDetails?.last_name].filter(Boolean).join(' ').trim() || 'Valued Client';
    const prompt = `You are an expert executive assistant for ${tenantDetails.name}.
Below is a conversation history with a client named ${clientName}.

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
    console.log(prompt);
    const aiResponse = await this.callGenAI(prompt);
    const cleanJson = aiResponse.replace(/```json|```/g, "").trim();
    const result = JSON.parse(cleanJson);

    // Format newlines for display
    return result.crux.replace(/\n/g, '<br />');
  }
}


module.exports = new AIService();
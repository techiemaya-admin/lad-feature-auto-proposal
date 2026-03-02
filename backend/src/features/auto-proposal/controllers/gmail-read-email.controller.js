const gmailService = require("../services/gmail-read-email.service");
const logger = require('../../../utils/logger');
const finalPriceCalculationService = require("../services/final-price-calculaton.service");
const aiResponseService = require("../services/ai-response.service");
const proposalDraftRepository = require("../repositories/proposal-draft.repository");
const { file } = require("pdfkit");

async function startWatch(req, res) {
    logger.info("Testing start watch>>")
  const result = await gmailService.startWatch();
  console.log(result)
  res.json(result.data);
}

async function webhook(req, res) {
    logger.info('Received webhook:');
  try {
    const message = req.body.message;
    const data = JSON.parse(
      Buffer.from(message.data, "base64").toString()
    );
console.log("Webhook data:", data);
    const historyId = data.historyId;
console.log("History ID:", historyId);

    // await gmailService.fetchNewEmails(historyId);
// await gmailService.fetchNewEmails(5556770);
await gmailService.fetchNewEmails(39529);

    res.status(200).send("Processed");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
}



    async function testprompt(req,res) {
        

        console.log("Testing AI prompt in controller : "+req.body.prompt);
       const leadDetails= await gmailService.createLeadRequirementViaPrompt(req.body.prompt);
       console.log("Lead details received in controller:", leadDetails);

        const calculatedPriceDetails = await finalPriceCalculationService.calculateFinalPrice(leadDetails.tenant_id, leadDetails.location, leadDetails.main_event_guests,leadDetails.catering_guests, leadDetails.function_hall_guests);
        console.log("Final price calculated:", calculatedPriceDetails);
        const formattedData = formatConceptPricingResponse(calculatedPriceDetails, leadDetails.location, leadDetails.main_event_guests, leadDetails.catering_guests, leadDetails.function_hall_guests, leadDetails.event_category);
        console.log("formatted>>>>>")
        console.log(formattedData);

const matrixIds = calculatedPriceDetails.map(
  item => item.concept_pricing_matrix_id
);
const final_price=(formattedData.totalImpactPrice || 0) + (formattedData.totalLitePrice || 0);
console.log(matrixIds);
        const prosalPathDetails =await aiResponseService.generateQuotationProposal(formattedData);
        const dataToSave = {
            tenant_id: leadDetails.tenant_id,
            lead_requirement_id: leadDetails.id,
            final_price: final_price,
          gcsUrl: prosalPathDetails.gcsUrl,
          file_name: prosalPathDetails.fileName,
            status: "DRAFTED",
            metadata: {formattedData},
            concept_pricing_matrix_ids: matrixIds
          }
        proposalDraftRepository.create(dataToSave)
        return res.json({ leadDetails, calculatedPriceDetails });
     }

     function formatConceptPricingResponse(
  results,
  locationName,
  mainEventGuestCount,
  cateringGuestCount,
  functionHallGuestCount,
  eventCategory) {
  const data = {
    location: locationName || null,
    mainEventGuestCount,
    cateringGuestCount,
    functionHallGuestCount,
    eventCategory,
  };

  for (const concept of results) {
    const conceptName = concept.concept_name.toUpperCase();

    if (conceptName === "LITE") {
      data.mainEventGuestLitePrice =
        concept.breakdown.main_event_price;

      data.cateringGuestLitePrice =
        concept.breakdown.catering_price;

      data.functionHallGuestLitePrice =
        concept.breakdown.functionhall_price;

      data.totalLitePrice = concept.final_price;
    }

    if (conceptName === "IMPACT") {
      data.mainEventGuestImpactPrice =
        concept.breakdown.main_event_price;

      data.cateringGuestImpactPrice =
        concept.breakdown.catering_price;

      data.functionHallGuestImpactPrice =
        concept.breakdown.functionhall_price;

      data.totalImpactPrice = concept.final_price;
    }
  }

  return data;
}
module.exports = { startWatch, webhook, testprompt };
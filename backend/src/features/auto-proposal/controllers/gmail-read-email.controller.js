const gmailService = require("../services/gmail-read-email.service");
const logger = require('../../../utils/logger');

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
    
       const response= await gmailService.createLeadRequirementViaPrompt(req.body.prompt);
       res.json(response);
    }

module.exports = { startWatch, webhook, testprompt };
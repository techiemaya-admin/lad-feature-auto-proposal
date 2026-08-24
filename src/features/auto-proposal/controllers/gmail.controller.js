const gmailService = require("../services/gmail-send-email.service");

async function sendEmail(req, res) {
  try {
    const result = await gmailService.sendEmail();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function readEmails(req, res) {
  try {
    const emails = await gmailService.readEmails();
    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function webhook(req, res) {
  const response = gmailService.handleWebhook(req.body);
  res.status(200).json(response);
}

module.exports = {
  sendEmail,
  readEmails,
  webhook,
};
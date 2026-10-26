const logger = require("../../../utils/logger");

async function sendEmail(req, res) {
  logger.warn("Attempt to access deprecated endpoint: /api/gmail/send-email", {
    tenantId: req.tenantId,
    ip: req.ip,
  });
  return res.status(410).json({
    error: "Gone: /api/gmail/send-email has been deprecated. Proposal quotations are dispatched via /api/proposal-draft/approve/:id.",
  });
}

async function readEmails(req, res) {
  logger.warn("Attempt to access deprecated endpoint: /api/gmail/read-emails", {
    tenantId: req.tenantId,
    ip: req.ip,
  });
  return res.status(410).json({
    error: "Gone: /api/gmail/read-emails has been deprecated. Inbound emails are processed asynchronously via Google Pub/Sub push webhook (/api/gmail/webhook).",
  });
}

function webhook(req, res) {
  return res.status(200).json({ status: "ok" });
}

module.exports = {
  sendEmail,
  readEmails,
  webhook,
};
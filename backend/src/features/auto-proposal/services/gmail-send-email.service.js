const { google } = require("googleapis");
const { oAuth2Client } = require("../../../config/google.config");

async function sendEmail() {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  const message = [
    "From: lvdhamija@gmail.com",
    "To: shwetagoel1711@gmail.com",
    "Subject: Hello from Gmail API",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "This email is sent using Gmail API directly.",
  ].join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });

  return response.data;
}

async function sendQuotationEmail(senderEmail, url, price) {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  const message = [
    `To: ${senderEmail}`,
    "Subject: Here are the Quotation details you requested",
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    `
    <p>Your proposal is ready.</p>
    <p><strong>Total Price:</strong> ${price}</p>
    <p>
      <a href="${url}" target="_blank">
        Download Proposal
      </a>
    </p>
  `,
  ].join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });

  console.log("Email sent:", response.data);
  return response.data;
}

module.exports = { sendEmail, sendQuotationEmail };
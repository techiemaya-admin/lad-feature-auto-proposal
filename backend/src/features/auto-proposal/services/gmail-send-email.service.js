const { google } = require("googleapis");
const { oAuth2Client } = require("../../../config/google.config");
const repository = require('../repositories/email-template.repository');
const quotationEmailTemplateRepo = require('../repositories/quotation-email-template.repository');
const templateRepo = require('../repositories/email-template.repository');
const placeholderRepo = require('../repositories/quotation-placeholder.repository');
const _ = require('lodash');
const axios = require('axios'); // You'll need this to fetch the file from the URL
const mammoth = require("mammoth");
const { Storage } = require("@google-cloud/storage");
const emailTemplateService = require("./email-template.service");
const conversationMessageRepository = require("../repositories/conversation-message.repository");

const storage = new Storage({
  keyFilename: process.env.GCS_KEY_FILE, // service-account.json
});

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

async function processAndSendDefaultEmail(tenantId, data, url, price) {
  console.log(" tenantid : " + tenantId + " date : " + JSON.stringify(data) + " price: " + price);
  if (data.lead_email) {
    try {
      const SOCIAL_ICONS = {
        instagram_url: "https://cdn-icons-png.flaticon.com/32/174/174855.png",
        linkedin_url: "https://cdn-icons-png.flaticon.com/32/174/174857.png",
        whatsapp_url: "https://cdn-icons-png.flaticon.com/32/733/733585.png"
      };

      // 1. Fetch Template
      const template = await repository.findDefaultByTenant(tenantId);
      let htmlValue;
      let finalSubject;

      // 3. Replace Placeholders
      const templateData = { ...data, price, url };
      const placeholderRegex = /{{(.*?)}}|\[(.*?)\]/g;
      const replaceFn = (match, p1, p2) => {
        const key = (p1 || p2).trim();
        const value = _.get(templateData, key);
        // 1. Handle the Logo (The Signed URL)
        if (key === 'logo_url' || key === 'company_logo') {
          if (value && value.trim() !== "") {
            // We wrap the long signed URL in an img tag
            // Adjust width/height as needed for your design
            return `<img src="${value}" alt="Company Logo" width="150" style="display: block; margin-bottom: 20px; border: 0;" />`;
          }
          return ""; // Hide if no logo exists
        }

        // If it's a social media key and we have a URL for it
        if (SOCIAL_ICONS[key]) {
          if (value && value.trim() !== "") {
            // Return a clickable image snippet
            return `
        <a href="${value}" target="_blank" style="text-decoration: none; margin-right: 10px;">
          <img src="${SOCIAL_ICONS[key]}" alt="${key}" width="24" height="24" style="display: inline-block; border: 0;" />
        </a>`.replace(/\s+/g, ' ').trim();
          } else {
            return ""; // Hide the icon if no URL is provided for this lead/tenant
          }
        }

        if (SOCIAL_ICONS[key]) {
          if (value && value.trim() !== "") {
            // Return a clickable image snippet
            return `
        <a href="${value}" target="_blank" style="text-decoration: none; margin-right: 10px;">
          <img src="${SOCIAL_ICONS[key]}" alt="${key}" width="24" height="24" style="display: inline-block; border: 0;" />
        </a>`.replace(/\s+/g, ' ').trim();
          } else {
            return ""; // Hide the icon if no URL is provided for this lead/tenant
          }
        }

        // 2. Handle Clickable Website
        if (key === 'company_website_url' || key == 'company_website' || key === 'website') {
          if (value) {
            // Ensure the URL starts with http so the link works correctly
            const url = value.startsWith('http') ? value : `https://${value}`;
            return `<a href="${url}" style="color: #4F46E5; text-decoration: underline;">${value}</a>`;
          }
        }

        // 3. Handle Clickable Email
        if (key === 'company_email' || key === 'contact_email') {
          if (value) {
            return `<a href="mailto:${value}" style="color: #4F46E5; text-decoration: underline;">${value}</a>`;
          }
        }

        return value !== undefined ? value : match;
      };
      if (!template) {
        htmlValue = await emailTemplateService.defaultEmailTemplateIfNoTemplateUpload();
        finalSubject = "Qutotation from [company_name]".replace(placeholderRegex, replaceFn);
      } else {
        // 2. Convert .docx to HTML
        const bucket = storage.bucket(process.env.GCS_BUCKET);
        const [fileBuffer] = await bucket.file(template.storage_path).download();
        const { value: rawHtml } = await mammoth.convertToHtml({ buffer: fileBuffer });
        htmlValue = rawHtml;
        finalSubject = template.subject_line.replace(placeholderRegex, replaceFn);
      }
      const finalHtml = htmlValue.replace(placeholderRegex, replaceFn);


      // 4. Fetch Attachment
      let attachmentBase64 = "";
      const filename = "Proposal.pdf";
      try {
        const attachmentRes = await axios.get(url, { responseType: 'arraybuffer' });
        attachmentBase64 = Buffer.from(attachmentRes.data).toString('base64');
      } catch (err) {
        console.error("Attachment fetch failed:", err.message);
      }

      // 5. Build RFC 2822 Message (Using \r\n is CRITICAL)
      const boundary = "__boundary_string_generated_123__";
      const CRLF = "\r\n";

      const emailHeaders = [
        `To: ${data.lead_email}`,
        `Subject: ${finalSubject}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        "" // Empty line between headers and body
      ].join(CRLF);

      const bodyPart = [
        `--${boundary}`,
        "Content-Type: text/html; charset=utf-8",
        "Content-Transfer-Encoding: 7bit",
        "",
        finalHtml,
        ""
      ].join(CRLF);

      const attachmentPart = attachmentBase64 ? [
        `--${boundary}`,
        `Content-Type: application/pdf; name="${filename}"`,
        `Content-Disposition: attachment; filename="${filename}"`,
        "Content-Transfer-Encoding: base64",
        "",
        attachmentBase64,
        ""
      ].join(CRLF) : "";

      const closingPart = `--${boundary}--`;

      const fullMessage = emailHeaders + CRLF + bodyPart + CRLF + attachmentPart + CRLF + closingPart;

      // 6. Encode and Send
      const encodedMessage = Buffer.from(fullMessage)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
        },
      });

      console.log("Email successfully sent:", response.data.id);
      return { success: true };

    } catch (error) {
      console.error("Automation Service Error:", error);
      throw error;
    }
  } else {
    console.warn("Email not sent because lead_email is undefined")
  }

}

async function processAndSendDefaultEmailFromDragDrop(tenantId, data, url, price, conversation_id) {
  console.log(`Sending email for tenant: ${tenantId} conversation_id: ${conversation_id} lead_email: ${data.lead_email} url: ${url} price: ${price}`);

  if (!data.lead_email) {
    console.warn("Email not sent because lead_email is undefined");
    return;
  }

  try {
    const SOCIAL_ICONS = {
      instagram_url: "https://cdn-icons-png.flaticon.com/32/174/174855.png",
      linkedin_url: "https://cdn-icons-png.flaticon.com/32/174/174857.png",
      whatsapp_url: "https://cdn-icons-png.flaticon.com/32/733/733585.png"
    };

    // 1. Fetch Template from Database
    const template = await quotationEmailTemplateRepo.findDefaultByTenant(tenantId);
    console.log("templaete :: " + JSON.stringify(template));
    let htmlContent = "";
    let subjectLine = "";

    // Regex for placeholders {{key}} or [key]
    const placeholderRegex = /{{(.*?)}}|\[(.*?)\]/g;
    const templateData = { ...data, price, url };

    const replaceFn = (match, p1, p2) => {
      const key = (p1 || p2).trim();
      const value = _.get(templateData, key);

      // Handle Logo
      if (key === 'logo_url' || key === 'company_logo') {
        return value ? `<img src="${value}" alt="Logo" width="150" style="display:block; margin-bottom:20px; border:0;" />` : "";
      }

      // Handle Social Icons
      if (SOCIAL_ICONS[key]) {
        return value ? `
          <a href="${value}" target="_blank" style="text-decoration: none; margin-right: 10px;">
            <img src="${SOCIAL_ICONS[key]}" alt="${key}" width="24" height="24" style="display: inline-block; border: 0;" />
          </a>`.replace(/\s+/g, ' ').trim() : "";
      }

      // Handle Website Links
      if (['company_website_url', 'company_website', 'website'].includes(key)) {
        if (!value) return "";
        const formattedUrl = value.startsWith('http') ? value : `https://${value}`;
        return `<a href="${formattedUrl}" style="color: #4F46E5; text-decoration: underline;">${value}</a>`;
      }

      return value !== undefined ? value : match;
    };

    // 2. Determine Content Source
    if (!template && template === undefined) {
      // Fallback if no default template exists in DB
      htmlContent = await emailTemplateService.defaultEmailTemplateIfNoTemplateUpload();
      subjectLine = "Quotation from [company_name]";
    } else {
      subjectLine = template.subject;

      // Logic for HTML vs Plain Text
      if (template.content_format === 'html') {
        htmlContent = template.body_html;
      } else {
        // If it's plain text, we wrap it in basic HTML to preserve line breaks
        htmlContent = `<div style="white-space: pre-wrap; font-family: sans-serif;">${template.body_text}</div>`;
      }
    }
    // If media_url exists in the incoming 'data' object, prepend it to the htmlContent
    if (template.media_url) {
      const mediaHtml = `
    <div style="text-align:center; margin-bottom:20px;">
      <img src="${template.media_url}" alt="Header Media" style="max-width:100%; height:auto; display:block; margin:0 auto;" />
    </div>`;
      htmlContent = mediaHtml + htmlContent;
    }
    // 3. Perform Replacements
    const finalSubject = subjectLine.replace(placeholderRegex, replaceFn);
    const finalHtml = htmlContent.replace(placeholderRegex, replaceFn);

    // 4. Fetch Attachment (Same as before)
    let attachmentBase64 = "";
    const filename = "Proposal.pdf";
    try {
      const attachmentRes = await axios.get(url, { responseType: 'arraybuffer' });
      attachmentBase64 = Buffer.from(attachmentRes.data).toString('base64');
    } catch (err) {
      console.error("Attachment fetch failed:", err.message);
    }

    // 5. Build RFC 2822 Message
    const boundary = "__boundary_string_generated_123__";
    const CRLF = "\r\n";

    const emailHeaders = [
      `To: ${data.lead_email}`,
      `Subject: ${finalSubject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ""
    ].join(CRLF);

    const bodyPart = [
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      finalHtml,
      ""
    ].join(CRLF);

    const attachmentPart = attachmentBase64 ? [
      `--${boundary}`,
      `Content-Type: application/pdf; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      attachmentBase64,
      ""
    ].join(CRLF) : "";

    const fullMessage = emailHeaders + CRLF + bodyPart + CRLF + attachmentPart + CRLF + `--${boundary}--`;

    // 6. Encode and Send via Gmail API
    const encodedMessage = Buffer.from(fullMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    console.log("Email successfully sent:", response.data.id);
    // 7. Save to Database
    // 7. Save to Database using your createMessage method
    try {
      const leadId = data.lead_id || data.id; // Fallback for contact identifier

      const messageData = {
        tenant_id: tenantId,
        conversation_id: conversation_id, // Ensure this is in the 'data' object
        sender_type: 'agent',
        sender_id: null, // Or the ID of the logged-in user
        channel: 'email',
        message_type: 'email',
        content: finalHtml,
        message_id: response.data.id, // Gmail's message ID
        raw_payload: {
          subject: finalSubject,
          to: data.lead_email,
          // Saving attachment info so the UI can render the download link
          attachments: attachmentBase64 ? [{
            filename: filename,
            url: url, // The link to the PDF
            type: "application/pdf"
          }] : []
        }
      };

      // Call your specific method
      const savedMsg = await conversationMessageRepository.createMessage(messageData);
      console.log("Message archived in DB:", savedMsg.id);

    } catch (dbError) {
      // Log the error but don't stop the process since the email was already sent
      console.error("Archive Error: Failed to save sent email to DB.", dbError);
    }
    return { success: true };

  } catch (error) {
    console.error("Email Service Error:", error);
    throw error;
  }
}

// services/email.service.js

async function sendGmailWithAttachments({ to, subject, html, attachments }) {
  const boundary = "bulk_mail_boundary_" + Date.now();
  const CRLF = "\r\n";

  let messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    ""
  ];

  // Add each attachment to the message
  attachments.forEach((file) => {
    // Note: 'content' should be the Base64 string from frontend
    // If the frontend sends 'url', you'd need to fetch it first.
    messageParts.push(
      `--${boundary}`,
      `Content-Type: ${file.contentType}; name="${file.filename}"`,
      `Content-Disposition: attachment; filename="${file.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      file.content, // The Base64 data
      ""
    );
  });

  messageParts.push(`--${boundary}--`);

  const rawMessage = messageParts.join(CRLF);
  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });

  return res.data;
}
async function sendGmailRaw({ to, subject, html }) {
  const boundary = "__bulk_boundary__";
  const CRLF = "\r\n";

  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: text/html; charset=utf-8`,
    "Content-Transfer-Encoding: 7bit",
    "",
    html
  ];

  const rawMessage = messageParts.join(CRLF);
  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });

  return res.data;
}


module.exports = { processAndSendDefaultEmail, sendQuotationEmail, processAndSendDefaultEmailFromDragDrop, sendGmailRaw, sendGmailWithAttachments };
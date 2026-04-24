const path = require('path');
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const mammoth = require("mammoth");
const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require("uuid");
const quotationPlaceholderRepository = require('../repositories/quotation-placeholder.repository');
const _ = require('lodash');
const storage = new Storage({
    keyFilename: process.env.GCS_KEY_FILE, // service-account.json
});
const templateRepository = require('../repositories/quotation-template-metadata.repository');

const { uploadToGCS } = require('../../../utils/gcsUploader');
const nullParser = (tag) => {
    return {
        get: (scope) => {
            return tag === "." ? scope : scope[tag];
        }
    };
};
class TestService {

    async sendDefaultTemplateEmail(req, res) {
        const tenantId = "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5";
        const leadData = {
            id: "fe2c9488-c7a6-44f4-a8f9-ee0b00c9e0da",
            lead_name: "Test Lead",
            lead_email: "usha.dhamija0510@gmail.com",
        }
        const url="https://storage.googleapis.com/event-proposal-testing/proposals/e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5/1776771095627_final_quote.pdf?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=lad-auto-proposal%40lad-develop.iam.gserviceaccount.com%2F20260421%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260421T113137Z&X-Goog-Expires=604800&X-Goog-SignedHeaders=host&X-Goog-Signature=26d677fb321ffca50fc8c44b8cc838669fa8b4dbeb539abf907abe565ef34760ca77715e2aa3e337bb9c1e3e64636b848e6cea3937aa1590671008538256a1ca0519c67d3fb2bb3e42adc8c2870ba2cd9389c32201e448c7a94cdb70bbcb0f86ae17646c457e7ff9d000f92f486a2a7a6ad4f5397fa7e3e1c410fbed6f7c7811cce96ad95e6dcbc051236ef208bb8b2731953fafef1cb7be4b91b9b7b83fa44f19796cea0f6c746184833d1c2a3b184d92c410b462cb451fd6e20aed4a52d27e621ab52315e368a474879c03913df9183ba2fb78881fa73dd8825ec112d3a26e235e1625909a015b2c4aa5c4640193f9dd606b217bdd4bb8eb7b7c2cae64ee2d";
        const price=1000;
        const gmailSendService = require('./gmail-send-email.service');
        return gmailSendService.processAndSendDefaultEmail(tenantId, leadData, url, price);
    }
    
    async generateAndUploadProposal(req, res) {
        try {
            const leadData = {
                id: "fe2c9488-c7a6-44f4-a8f9-ee0b00c9e0da",
                lead_name: "Test Lead",
                lead_email: "abc@gmail.com",
                lead_phone: "1234567890",
                tenant_name: "Test Tenant",
                tenant_address: "123 Test Street, Test City, Test Country",
                tenant_phone: "9876543210",
                tenant_email: "tenant@example.com",
                current_date: new Date().toLocaleDateString()
            }
            const tenantId = "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5";

            // 1. Fetch Template Metadata from DB
            const templateMetadata = await templateRepository.findDefaultByTenant(tenantId);
            if (!templateMetadata) throw new Error("No default template found.");
            const proposalsDir = path.join(__dirname, "../proposals");
            await fs.mkdir(proposalsDir, { recursive: true });
            // -----------------------------

            let fileName = `quotation - ${uuidv4()}.pdf`;
            // Define localPath relative to the directory we just ensured exists
            const localPath = path.join(proposalsDir, fileName);
            // 2. Download .docx from GCS
            const bucket = storage.bucket(process.env.GCS_BUCKET);
            const [templateBuffer] = await bucket.file(templateMetadata.storage_path).download();

            // 3. Replace Placeholders in .docx
            const zip = new PizZip(templateBuffer);
            const doc = new Docxtemplater(zip, {
                delimiters: { start: '[', end: ']' }, // Change delimiters to single brackets
                paragraphLoop: true,
                linebreaks: true,
                parser: nullParser // This helps ignore internal XML fragmentation
            });
// 1. Fetch Dynamic Placeholder Config from DB 
            const placeholders = await quotationPlaceholderRepository.findByTenant(tenantId);

            // 2. Build the Render Object dynamically
            const renderData = {};
            
            placeholders.forEach(item => {
                // Map the placeholder_key (e.g., 'leadname') 
                // to the value at data_source_path (e.g., 'name')
                // Using _.get handles nested paths like 'lead.name' safely
                renderData[item.placeholder_key] = _.get(leadData, item.data_source_path, "");
            });

            // Add any hardcoded defaults if necessary
            renderData['date'] = new Date().toLocaleDateString();
            doc.render(renderData);
            
            const filledDocxBuffer = doc.getZip().generate({ type: "nodebuffer" });

            // 4. Convert Filled .docx to HTML
            const { value: htmlBody } = await mammoth.convertToHtml({ buffer: filledDocxBuffer });

            // 5. Generate PDF via Puppeteer
            const browser = await puppeteer.launch({ headless: "new" });
            const page = await browser.newPage();

            // Injecting CSS to keep the "Glinks" look (indigo headers, clean tables)
            const fullHtml = `
            <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 50px; color: #333; }
                        table { width: 100%; border-collapse: collapse; margin-top: 25px; }
                        th { background-color: #1a237e; color: white; padding: 12px; text-align: left; }
                        td { border-bottom: 1px solid #eee; padding: 12px; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1a237e; padding-bottom: 20px; }
                        .total-section { margin-top: 30px; text-align: right; font-size: 1.2em; font-weight: bold; }
                    </style>
                </head>
                <body>
                    ${htmlBody}
                </body>
            </html>
        `;

            await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

            await page.pdf({
                path: localPath,
                format: 'A4',
                printBackground: true,
                margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
            });

            await browser.close();

            // 6. Upload final PDF back to GCS
            const destination = `proposals/${tenantId}/${Date.now()}_final_quote.pdf`;
            const gcsUrl = await uploadToGCS(localPath, destination);

            // 7. Cleanup local temp file
            await fs.unlink(localPath);
            console.log("Generated proposal uploaded to GCS at:", gcsUrl);
            return gcsUrl;

        } catch (error) {
            console.error("Proposal Generation Failed:", error);
            throw error;
        }
    }
}

module.exports = new TestService();
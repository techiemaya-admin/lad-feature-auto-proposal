/**
 * Developer Smoke Test Runner
 * Run directly via CLI: node scripts/dev/smoke-test.js
 * 
 * Tests the proposal generation pipeline in development mode
 * using configurable environment variables rather than hardcoded credentials in production routes.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const crypto = require('crypto');
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const mammoth = require("mammoth");
const puppeteer = require("puppeteer");
const { Storage } = require('@google-cloud/storage');
const quotationPlaceholderRepository = require('../../src/features/auto-proposal/repositories/quotation-placeholder.repository');
const templateRepository = require('../../src/features/auto-proposal/repositories/quotation-template-metadata.repository');
const { uploadToGCS } = require('../../src/utils/gcsUploader');

const nullParser = (tag) => ({
  get: (scope) => (tag === "." ? scope : scope[tag])
});

async function runSmokeTest() {
  const tenantId = process.env.DEV_TEST_TENANT_ID || process.env.DEFAULT_TENANT_ID || "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5";
  console.log(`[Smoke Test] Starting test for Tenant: ${tenantId}...`);

  try {
    const templateMetadata = await templateRepository.findDefaultByTenant(tenantId);
    if (!templateMetadata) {
      console.warn(`[Smoke Test] No default template found for tenant ${tenantId}. Ensure database is seeded.`);
      return;
    }

    const tempDir = path.join(os.tmpdir(), 'lad-dev-tests');
    await fs.mkdir(tempDir, { recursive: true });
    const localPdfPath = path.join(tempDir, `quotation-${crypto.randomUUID()}.pdf`);

    const storage = new Storage({ keyFilename: process.env.GCS_KEY_FILE });
    const bucket = storage.bucket(process.env.GCS_BUCKET);
    const [templateBuffer] = await bucket.file(templateMetadata.storage_path).download();

    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      delimiters: { start: '[', end: ']' },
      paragraphLoop: true,
      linebreaks: true,
      parser: nullParser
    });

    const placeholders = await quotationPlaceholderRepository.findByTenant(tenantId);
    const mockLeadData = {
      id: crypto.randomUUID(),
      lead_name: "Developer Smoke Test",
      lead_email: "dev-test@example.com",
      date: new Date().toLocaleDateString()
    };

    const renderData = { date: new Date().toLocaleDateString() };
    placeholders.forEach(item => {
      renderData[item.placeholder_key] = mockLeadData[item.data_source_path] || "";
    });

    doc.render(renderData);
    const filledDocxBuffer = doc.getZip().generate({ type: "nodebuffer" });

    const { value: htmlBody } = await mammoth.convertToHtml({ buffer: filledDocxBuffer });
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(`<html><body>${htmlBody}</body></html>`, { waitUntil: 'networkidle0' });
    await page.pdf({ path: localPdfPath, format: 'A4' });
    await browser.close();

    console.log(`[Smoke Test] Generated PDF successfully at temp path: ${localPdfPath}`);
    // Cleanup local temp file
    await fs.unlink(localPdfPath);
    console.log(`[Smoke Test] Completed successfully.`);
  } catch (err) {
    console.error(`[Smoke Test] Failed with error:`, err);
  }
}

if (require.main === module) {
  runSmokeTest();
}

module.exports = { runSmokeTest };

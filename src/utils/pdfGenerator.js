// utils/pdfGenerator.js
const PDFDocument = require("pdfkit");
const fs = require("fs");

async function generatePDF(data, outputPath) {
  console.log("generatePDF called with data:", data);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Title
    doc.fontSize(26).text("Quotation", { align: "left" });
    doc.moveDown();

    // Date
    doc.fontSize(12).text(`Date: ${data.date}`);
    doc.moveDown(2);

    // Event Details
    doc.fontSize(16).text("Event Details", { underline: true });
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`• Location: ${data.location}`);
    doc.text(`• Event Category: ${data.eventCategory}`);
    doc.text(`• Main Event Guests: ${data.mainEventGuestCount}`);
    doc.text(`• Catering Guests: ${data.cateringGuestCount}`);
    doc.text(`• Function Hall Guests: ${data.functionHallGuestCount}`);

    doc.moveDown(2);

    // Table Header
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 180;
    const col3 = 280;
    const col4 = 380;
    const col5 = 480;

    doc.fontSize(12).text("Category", col1, tableTop);
    doc.text("Main Event (AED)", col2, tableTop);
    doc.text("Catering (AED)", col3, tableTop);
    doc.text("Function Hall (AED)", col4, tableTop);
    doc.text("Total (AED)", col5, tableTop);

    doc.moveDown();

    // LITE Row
    const liteRow = doc.y;
    doc.text("LITE", col1, liteRow);
    console.log("data.mainEventGuestLitePrice : " + data.mainEventGuestLitePrice);
    doc.text(data.mainEventGuestLitePrice.toLocaleString(), col2, liteRow);
    doc.text(data.cateringGuestLitePrice.toLocaleString(), col3, liteRow);
    doc.text(data.functionHallGuestLitePrice.toLocaleString(), col4, liteRow);
    doc.text(data.totalLitePrice.toLocaleString(), col5, liteRow);

    doc.moveDown();

    // IMPACT Row
    const impactRow = doc.y;
    doc.text("IMPACT", col1, impactRow);
    doc.text(data.mainEventGuestImpactPrice.toLocaleString(), col2, impactRow);
    doc.text(data.cateringGuestImpactPrice.toLocaleString(), col3, impactRow);
    doc.text(data.functionHallGuestImpactPrice.toLocaleString(), col4, impactRow);
    doc.text(data.totalImpactPrice.toLocaleString(), col5, impactRow);

    doc.moveDown(3);

    // Notes Section
    doc.fontSize(16).text("Notes", { underline: true });
    doc.moveDown();

    doc.fontSize(12);
    doc.text("• Prices are subject to 5% VAT.");
    doc.text("• Venue, AV setup, staging, and permits are not included unless specified.");
    doc.text("• Final pricing may vary depending on customization and venue policies.");
    doc.text("• A 15% discount applies if multiple team-building concepts are booked on the same day.");

    doc.end();

    stream.on("finish", () => resolve(outputPath));
    stream.on("error", reject);

  });
}

module.exports = { generatePDF };
// utils/pdfGenerator.js
// const puppeteer = require("puppeteer");
// const fs = require("fs");
// const path = require("path");
// const { v4: uuidv4 } = require("uuid");


const PDFDocument = require("pdfkit");
const fs = require("fs");
// async function generatePDF(data,fileName,filePath) {
//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();

//   const html = generateQuotationHTML(data);
//   await page.setContent(html, { waitUntil: "networkidle0" });

//   await page.pdf({
//     path: filePath,
//     format: "A4",
//     printBackground: true
//   });

//   await browser.close();
//   return filePath;
// }

async function generatePDF(data, outputPath) {
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
    
//     const doc = new PDFDocument();

//     const stream = fs.createWriteStream(outputPath);

//     doc.pipe(stream);

//     doc.fontSize(18).text("Quotation", { align: "center" });
//     doc.moveDown();

//     doc.fontSize(12).text(content, {
//       align: "left",
//     });

//     doc.end();

//     stream.on("finish", resolve);
//     stream.on("error", reject);
//   });
// }

function generateQuotationHTML(data) {
  return `
  <html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 40px;
      }

      h1 {
        margin-bottom: 10px;
      }

      .section-title {
        font-weight: bold;
        margin-top: 30px;
        margin-bottom: 10px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }

      th, td {
        border: 2px solid #8a8a8a;
        padding: 10px;
        text-align: center;
        font-size: 14px;
      }

      th {
        background-color: #e6e6e6;
      }

      td:first-child, th:first-child {
        text-align: left;
      }
    </style>
  </head>
  <body>

    <h1>Quotation</h1>
    <p><strong>Date:</strong> ${data.date}</p>

    <div class="section-title">Event Details</div>
    <ul>
      <li>Location: ${data.location}</li>
      <li>Event Category: ${data.eventCategory}</li>
      <li>Main Event Guests: ${data.mainEventGuestCount}</li>
      <li>Catering Guests: ${data.cateringGuestCount}</li>
      <li>Function Hall Guests: ${data.functionHallGuestCount}</li>
    </ul>

    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Main Event (AED)</th>
          <th>Catering (AED)</th>
          <th>Function Hall (AED)</th>
          <th>Total (AED)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>LITE</td>
          <td>${data.mainEventGuestLitePrice.toLocaleString()}</td>
          <td>${data.cateringGuestLitePrice.toLocaleString()}</td>
          <td>${data.functionHallGuestLitePrice.toLocaleString()}</td>
          <td>${data.totalLitePrice.toLocaleString()}</td>
        </tr>
        <tr>
          <td>IMPACT</td>
          <td>${data.mainEventGuestImpactPrice.toLocaleString()}</td>
          <td>${data.cateringGuestImpactPrice.toLocaleString()}</td>
          <td>${data.functionHallGuestImpactPrice.toLocaleString()}</td>
          <td>${data.totalImpactPrice.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">Notes</div>
    <ul>
      <li>Prices are subject to 5% VAT.</li>
      <li>Venue, AV setup, staging, and permits are not included unless specified.</li>
      <li>Final pricing may vary depending on customization and venue policies.</li>
      <li>A 15% discount applies if multiple team-building concepts are booked on the same day.</li>
    </ul>

  </body>
  </html>
  `;
}


module.exports = { generatePDF };
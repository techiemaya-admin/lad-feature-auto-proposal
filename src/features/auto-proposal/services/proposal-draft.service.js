
const proposalRepo = require("../repositories/proposal-draft.repository");
const leadRepo = require("../repositories/lead.repository");
const attachmentRepo = require("../repositories/lead-attachment.repository");
const gmailService = require("./gmail-send-email.service");
const e = require("express");

class ProposalDraftService {


  async generateProposalHtml(data, leadInfo, globalPricing) {
    // 1. Find the specific concepts from the results array
    const liteConcept = data.find(c => c.concept_name === 'LITE');
    const impactConcept = data.find(c => c.concept_name === 'IMPACT');

    // 2. Summary Logic (Using IMPACT as the base for the final quote)
    const baseProposal = impactConcept ? impactConcept.final_price : 0;

    // Note: If markup/discount are already calculated in final_price, 
    // you might just want to display globalPricing values here for the label.
    const markupAmount = (baseProposal * globalPricing.markup) / 100;
    const discountAmount = (baseProposal * globalPricing.discount) / 100;
    const finalQuote = baseProposal; // Or your custom math logic

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; background-color: #f9fafb; margin: 0; padding: 40px; }
        .modal-container { background: white; border-radius: 40px; overflow: hidden; border: 1px solid #f3f4f6; box-shadow: 0 32px 64px -12px rgba(0,0,0,0.1); width: 1000px; margin: auto; }
        
        /* Top Bar */
        .top-bar { padding: 24px 48px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f3f4f6; background: #f9fafb; }
        .logo-box { width: 48px; height: 48px; background: #4f46e5; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: white; }
        .title-area h2 { font-size: 24px; font-weight: 900; margin: 0; color: #111827; }
        .title-area p { font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; margin: 4px 0 0 0; }

        /* Main Content */
        .content-layout { display: table; width: 100%; border-collapse: collapse; }
        .main-area { display: table-cell; padding: 40px; vertical-align: top; }
        .sidebar { display: table-cell; width: 280px; background: #f9fafb; padding: 32px; border-left: 1px solid #f3f4f6; vertical-align: top; }

        /* Comparison Cards */
        .card-grid { display: flex; gap: 20px; margin-bottom: 40px; }
        .card { flex: 1; border-radius: 32px; padding: 32px; position: relative; min-height: 350px; }
        .lite-card { background: #f9fafb; border: 1px solid #f3f4f6; }
        .impact-card { background: #4f46e5; color: white; box-shadow: 0 20px 40px rgba(79, 70, 229, 0.2); }
        
        .tier-title { font-size: 28px; font-weight: 900; font-style: italic; margin-bottom: 4px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 9px; font-weight: 900; text-transform: uppercase; margin-bottom: 20px; }
        .lite-badge { background: #e5e7eb; color: #6b7280; }
        .impact-badge { background: rgba(255,255,255,0.2); color: white; }

        .price-section { margin-top: auto; padding-top: 24px; border-top: 1px solid rgba(0,0,0,0.05); }
        .impact-card .price-section { border-top: 1px solid rgba(255,255,255,0.1); }

        .price-item { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .price-item .label { font-size: 10px; font-weight: 900; text-transform: uppercase; opacity: 0.6; }
        .price-item .val { font-size: 12px; font-weight: 800; }

        .total-box { margin-top: 16px; text-align: right; }
        .total-val { font-size: 24px; font-weight: 900; }
        .total-label { font-size: 9px; font-weight: 700; text-transform: uppercase; opacity: 0.5; }

        /* Summary Section */
        .summary-title { font-size: 10px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; font-weight: 700; color: #6b7280; }
        .final-quote { border-top: 2px solid #e5e7eb; margin-top: 24px; padding-top: 24px; }
        .final-quote-label { font-size: 16px; font-weight: 900; color: #111827; }
        .final-quote-value { font-size: 22px; font-weight: 900; color: #4f46e5; }
      </style>
    </head>
    <body>
      <div class="modal-container">
        <div class="top-bar">
          <div class="title-area">
            <h2>Proposal Analysis</h2>
            <p>Lead: ${leadInfo.name}</p>
          </div>
          <div class="logo-box">⚡</div>
        </div>

        <div class="content-layout">
          <div class="main-area">
            <div class="card-grid">
              
              <div class="card lite-card">
                <div class="tier-title">LITE</div>
                <div class="badge lite-badge">Essential</div>
                
                <div class="price-section">
                  ${liteConcept.breakdown.map(item => `
                    <div class="price-item">
                      <span class="label">${item.label}</span>
                      <span class="val">₹${item.price.toLocaleString()}</span>
                    </div>
                  `).join('')}
                  
                  <div class="total-box">
                    <div class="total-val">₹${liteConcept.final_price.toLocaleString()}</div>
                    <div class="total-label">Total Investment</div>
                  </div>
                </div>
              </div>

              <div class="card impact-card">
                <div class="tier-title">IMPACT</div>
                <div class="badge impact-badge">Premium</div>
                
                <div class="price-section">
                  ${impactConcept.breakdown.map(item => `
                    <div class="price-item">
                      <span class="label">${item.label}</span>
                      <span class="val">₹${item.price.toLocaleString()}</span>
                    </div>
                  `).join('')}
                  
                  <div class="total-box">
                    <div class="total-val">₹${impactConcept.final_price.toLocaleString()}</div>
                    <div class="total-label">Total Investment</div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div class="sidebar">
            <div class="summary-title">Summary</div>
            <div class="summary-row">
              <span>Base (Impact)</span>
              <span>₹${baseProposal.toLocaleString()}</span>
            </div>
            <div class="summary-row">
              <span>Markup (${globalPricing.markup}%)</span>
              <span style="color:#16a34a">+₹${markupAmount.toLocaleString()}</span>
            </div>
            <div class="summary-row">
              <span>Discount (${globalPricing.discount}%)</span>
              <span style="color:#dc2626">-₹${discountAmount.toLocaleString()}</span>
            </div>
            
            <div class="final-quote summary-row">
              <span class="final-quote-label">Final Quote</span>
              <span class="final-quote-value">₹${finalQuote.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  }

  async generateProposalForLeadHtml(placeholderData) {
    // Extract data from the placeholder object built by PlaceHolderBuilder
    const {
      lead_name, lead_email, company_name, company_email, company_phone,
      company_website, company_logo, company_tagline, total_base_price,
      total_discount, total_surcharge, final_price, items
    } = placeholderData;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; color: #333; line-height: 1.6; padding: 0; margin: 0; background: #fff; }
        .quote-container { max-width: 850px; margin: 40px auto; padding: 40px; border: 1px solid #eee; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { color: #8B5E3C; font-size: 32px; letter-spacing: 2px; text-transform: uppercase; margin: 0; }
        .header img { max-width: 150px; margin-bottom: 10px; }
        .header-details { margin-top: 10px; font-size: 14px; color: #666; }
        .address-grid { display: flex; justify-content: space-between; margin-bottom: 40px; font-size: 14px; }
        .address-box b { text-transform: uppercase; display: block; margin-bottom: 5px; color: #000; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #F3E5D8; color: #000; text-transform: uppercase; font-size: 12px; padding: 12px; text-align: left; border: 1px solid #D9C5B2; }
        td { padding: 12px; border: 1px solid #D9C5B2; font-size: 14px; }
        .text-right { text-align: right; }
        .summary-row td { background: #F9F3EE; font-weight: 600; }
        .total-row td { background: #EBD9C8; font-weight: 800; font-size: 16px; }
        .terms { margin-top: 40px; font-size: 12px; }
        .terms h3 { font-size: 14px; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .signature-section { margin-top: 60px; display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; }
        .sig-box { width: 200px; border-top: 1px solid #000; padding-top: 10px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="quote-container">
        <div class="header">
          ${company_logo ? `<img src="${company_logo}" alt="logo">` : ''}
          <h1>Sales Quotation</h1>
          <p><i>${company_tagline}</i></p>
          <div class="header-details">
            <b>Date:</b> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}<br>
            <b>Valid Until:</b> ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <div class="address-grid">
          <div class="address-box">
              <b>From:</b>
              ${company_name}<br>
              Email: ${company_email}<br>
              Phone: ${company_phone}<br>
              Website: ${company_website || 'N/A'}
          </div>
          <div class="address-box text-right">
            <b>To:</b>
            ${lead_name}<br>
            Email: ${lead_email}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th class="text-right">Quantity</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Total Price</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.description}</td>
                <td class="text-right">${item.qty}</td>
                <td class="text-right">₹${Number(item.unit_price).toLocaleString()}</td>
                <td class="text-right">₹${Number(item.line_total).toLocaleString()}</td>
              </tr>
            `).join('')}
            
            <tr class="summary-row">
              <td colspan="3" class="text-right">Subtotal</td>
              <td class="text-right">₹${total_base_price.toLocaleString()}</td>
            </tr>
            <tr class="summary-row">
              <td colspan="3" class="text-right">Markup / Adjustments</td>
              <td class="text-right" style="color:#16a34a">+₹${total_surcharge.toLocaleString()}</td>
            </tr>
            <tr class="summary-row">
              <td colspan="3" class="text-right">Discount</td>
              <td class="text-right" style="color:#dc2626">-₹${total_discount.toLocaleString()}</td>
            </tr>
            <tr class="total-row">
              <td colspan="3" class="text-right">Total Amount</td>
              <td class="text-right">₹${final_price.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="terms">
          <h3>Terms and Conditions:</h3>
          <ul>
            <li>Validity: This quotation is valid for 7 days from the date of issue.</li>
            <li>All services listed are subject to availability at the time of confirmation.</li>
          </ul>
        </div>

        <div class="signature-section">
          <div class="sig-box">Prepared By</div>
          <div class="sig-box">Client Approval</div>
        </div>
      </div>
    </body>
    </html>
  `;
  }
  async approveProposal(proposalId,oAuth2Client) {

    // 1️⃣ Get Draft
    const proposal = await proposalRepo.findDraftById(proposalId);
    if (!proposal) {
      throw new Error("Proposal not found or already approved");
    }

    // 2️⃣ Get Lead
    const lead = await leadRepo.findByLeadRequirementId(
      proposal.lead_requirement_id
    );

    if (!lead) {
      throw new Error("Lead not found");
    }

    // 3️⃣ Update Status
    await proposalRepo.approveProposalDraft(proposalId);

    // 4️⃣ Create Attachment
    const attachment = await attachmentRepo.create({
      tenant_id: proposal.tenant_id,
      lead_id: lead.id,
      quotation_template_metadata_id:
        proposal.quotation_template_metadata_id,
      file_url: proposal.gcs_storage_path,
      file_name: proposal.file_name,
      file_type: "application/pdf",
      uploaded_by: null,
      metadata: {
        proposal_id: proposal.id,
        final_price: proposal.final_price
      }
    });

    // // 5️⃣ Send Email
    gmailService.sendQuotationEmail(lead.email, proposal.gcs_storage_path, proposal.final_price,oAuth2Client);


    return {
      proposal_id: proposal.id,
      attachment_id: attachment.id
    };
  }

}

module.exports = new ProposalDraftService();
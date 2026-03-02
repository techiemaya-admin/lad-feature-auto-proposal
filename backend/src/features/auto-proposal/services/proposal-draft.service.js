
const proposalRepo = require("../repositories/proposal-draft.repository");
const leadRepo = require("../repositories/lead.repository");
const attachmentRepo = require("../repositories/lead-attachment.repository");
const gmailService = require("./gmail-send-email.service");

class ProposalDraftService {

  async approveProposal(proposalId) {

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
    gmailService.sendQuotationEmail(lead.email, proposal.gcs_storage_path, proposal.final_price);


    return {
      proposal_id: proposal.id,
      attachment_id: attachment.id
    };
  }

}

module.exports = new ProposalDraftService();
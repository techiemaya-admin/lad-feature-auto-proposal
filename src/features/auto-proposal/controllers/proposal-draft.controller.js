const proposalDraftService = require("../services/proposal-draft.service");
const logger = require("../../../utils/logger");

exports.approveProposalDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.headers?.['x-tenant-id'];

    const approved = await proposalDraftService.approveProposal(id, null, tenantId);

    return res.status(200).json({
      success: true,
      message: "Proposal approved successfully",
      data: approved
    });

  } catch (error) {
    logger.error("Error approving proposal draft:", error);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
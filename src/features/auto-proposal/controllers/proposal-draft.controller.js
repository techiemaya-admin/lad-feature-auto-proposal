const proposalDraftService = require("../services/proposal-draft.service");

exports.approveProposalDraft = async (req, res) => {
  try {
    const { id } = req.params;

    const approved = await proposalDraftService.approveProposal(id);

    return res.status(200).json({
      success: true,
      message: "Proposal approved successfully",
      data: approved
    });

  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
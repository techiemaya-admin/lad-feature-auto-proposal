const AppDataSource = require("../../../config/data-source");

class ProposalDraftConceptPricingMatrixRepository {

  // =====================================================
  // ATTACH MATRIX TO PROPOSAL
  // =====================================================
  async create(data) {
    console.log("Attaching pricing matrix:", data);

    const sql = `
      INSERT INTO proposal_draft_concept_pricing_matrix
      (
        proposal_draft_id,
        concept_pricing_matrix_id
      )
      VALUES ($1,$2)
      RETURNING *;
    `;

    const values = [
      data.proposal_draft_id,
      data.concept_pricing_matrix_id
    ];

    const result = await AppDataSource.query(sql, values);

    return result[0];
  }

  // =====================================================
  // GET MATRICES BY PROPOSAL
  // =====================================================
  async findByProposalDraftId(proposalDraftId) {
    const sql = `
      SELECT *
      FROM proposal_draft_concept_pricing_matrix
      WHERE proposal_draft_id = $1;
    `;

    return await AppDataSource.query(sql, [proposalDraftId]);
  }

  // =====================================================
  // REMOVE MATRIX FROM PROPOSAL
  // =====================================================
  async delete(proposalDraftId, conceptPricingMatrixId) {
    const sql = `
      DELETE FROM proposal_draft_concept_pricing_matrix
      WHERE proposal_draft_id = $1
      AND concept_pricing_matrix_id = $2
      RETURNING *;
    `;

    const result = await AppDataSource.query(sql, [
      proposalDraftId,
      conceptPricingMatrixId
    ]);

    return result[0];
  }

}

module.exports = new ProposalDraftConceptPricingMatrixRepository();
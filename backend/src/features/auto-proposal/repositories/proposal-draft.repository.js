const AppDataSource = require("../../../config/data-source");
const proposalDraftItemRepository = require("./proposal-draft-items.repository");

class ProposalDraftRepository {
  async findDraftById(id) {
    console.log("Finding draft proposal with ID:", id);
    const sql = `
      SELECT *
      FROM proposal_draft
      WHERE id = $1
      AND is_deleted = false;
    `;
    const result = await AppDataSource.query(sql, [id]);
    console.log("Draft proposal found:", result[0]);
    return result[0];
  }


  // =====================================================
  // CREATE PROPOSAL DRAFT
  // =====================================================
  async create(data) {
    console.log("Creating proposal draft:", data);

    const sql = `
      INSERT INTO proposal_draft
      (
        tenant_id,
        lead_requirement_id,
        final_price,
        gcs_storage_path,
        status,
        metadata,
        file_name,
        calculation_snapshot
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;

    const values = [
      data.tenant_id || "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5",
      data.lead_requirement_id || null,
      data.final_price,
      data.gcsUrl || null,
      data.status || "DRAFTED",
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.file_name || null,
      data.calculation_snapshot ? JSON.stringify(data.calculation_snapshot) : null
    ];

    const result = await AppDataSource.query(sql, values);
    const proposalDraftId = result[0].id;
    console.log("Proposal Draft created: {} ", proposalDraftId);
    console.log("data.calculation_snapshot: {} ", data.calculation_snapshot);
    const itemsForBulkCreate = data.calculation_snapshot.flatMap(concept =>
      concept.breakdown.map(item => ({
        tenant_id:data.tenant_id || "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5",
        proposal_draft_id: proposalDraftId, // The ID of the parent draft you just created
        concept_name: concept.concept_name,
        label: item.label,
        unit_count: item.count,
        total_price: item.price,
        applied_rules: item.applied_rules.map(ruleId => ({
          rule_id: ruleId,
          discount: item.total_discount,
          surcharge: item.total_surcharge
        }))
      }))
    );
    await proposalDraftItemRepository.bulkCreate(itemsForBulkCreate);
    return result[0];
  }

  async approveProposalDraft(id) {
    const sql = `
    UPDATE proposal_draft
    SET status = 'APPROVED',
        updated_at = now()
    WHERE id = $1
    AND is_deleted = false
    RETURNING *;
  `;

    const result = await AppDataSource.query(sql, [id]);
    return result[0];
  }

  // =====================================================
  // FIND BY ID
  // =====================================================
  async findById(id) {
    const sql = `
      SELECT *
      FROM proposal_draft
      WHERE id = $1
      AND is_deleted = false;
    `;

    const result = await AppDataSource.query(sql, [id]);
    return result[0];
  }

  // =====================================================
  // UPDATE STATUS
  // =====================================================
  async updateStatus(id, status) {
    const sql = `
      UPDATE proposal_draft
      SET status = $1,
          updated_at = now()
      WHERE id = $2
      RETURNING *;
    `;

    const result = await AppDataSource.query(sql, [status, id]);
    return result[0];
  }

  // =====================================================
  // UPDATE FULL RECORD
  // =====================================================
  async update(id, data) {
    const sql = `
      UPDATE proposal_draft
      SET
        final_price = $1,
        gcs_storage_path = $2,
        metadata = $3,
        quotation_template_metadata_id = $4,
        updated_at = now()
      WHERE id = $5
      RETURNING *;
    `;

    const values = [
      data.final_price,
      data.gcs_storage_path || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.quotation_template_metadata_id || null,
      id
    ];

    const result = await AppDataSource.query(sql, values);
    return result[0];
  }

  // =====================================================
  // SOFT DELETE
  // =====================================================
  async softDelete(id) {
    const sql = `
      UPDATE proposal_draft
      SET is_deleted = true,
          updated_at = now()
      WHERE id = $1
      RETURNING *;
    `;

    const result = await AppDataSource.query(sql, [id]);
    return result[0];
  }

}

module.exports = new ProposalDraftRepository();
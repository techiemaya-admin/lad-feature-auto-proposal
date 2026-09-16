const AppDataSource = require("../../../config/data-source");
const proposalDraftItemRepository = require("./proposal-draft-items.repository");
const logger = require("../../../utils/logger");

class ProposalDraftRepository {
  async findDraftById(id, tenantId = null) {
    logger.debug("Finding draft proposal with ID:", { id, tenantId });
    const params = [id];
    let sql = `
      SELECT *
      FROM proposal_draft
      WHERE id = $1
      AND is_deleted = false
    `;
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $2`;
    }
    const result = await AppDataSource.query(sql, params);
    logger.debug("Draft proposal query result:", { found: !!result[0] });
    return result[0];
  }

  // =====================================================
  // CREATE PROPOSAL DRAFT
  // =====================================================
  async create(data) {
    if (!data || !data.tenant_id) {
      throw new Error("tenant_id is strictly required to create a proposal draft");
    }

    logger.debug("Creating proposal draft:", { tenant_id: data.tenant_id, lead_requirement_id: data.lead_requirement_id });

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
      data.tenant_id,
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
    logger.info("Proposal Draft created successfully", { proposalDraftId, tenantId: data.tenant_id });

    const concept = data.calculation_snapshot;
    if (!concept || !concept.breakdown) {
      return result[0];
    }

    const itemsForBulkCreate = concept.breakdown.map(item => ({
      tenant_id: data.tenant_id,
      proposal_draft_id: proposalDraftId,
      concept_name: concept.concept_name,
      label: item.label,
      unit_count: item.count,
      total_price: item.price,
      applied_rules: (item.applied_rules || []).map(ruleId => ({
        rule_id: ruleId,
        discount: item.total_discount,
        surcharge: item.total_surcharge
      }))
    }));
    await proposalDraftItemRepository.bulkCreate(itemsForBulkCreate);
    return result[0];
  }

  async approveProposalDraft(id, tenantId = null) {
    const params = [id];
    let sql = `
      UPDATE proposal_draft
      SET status = 'APPROVED',
          updated_at = now()
      WHERE id = $1
      AND is_deleted = false
    `;
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $2`;
    }
    sql += ` RETURNING *;`;

    const result = await AppDataSource.query(sql, params);
    return result[0];
  }

  // =====================================================
  // FIND BY ID
  // =====================================================
  async findById(id, tenantId = null) {
    const params = [id];
    let sql = `
      SELECT *
      FROM proposal_draft
      WHERE id = $1
      AND is_deleted = false
    `;
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $2`;
    }

    const result = await AppDataSource.query(sql, params);
    return result[0];
  }

  // =====================================================
  // UPDATE STATUS
  // =====================================================
  async updateStatus(id, status, tenantId = null) {
    const params = [status, id];
    let sql = `
      UPDATE proposal_draft
      SET status = $1,
          updated_at = now()
      WHERE id = $2
    `;
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $3`;
    }
    sql += ` RETURNING *;`;

    const result = await AppDataSource.query(sql, params);
    return result[0];
  }

  // =====================================================
  // UPDATE FULL RECORD
  // =====================================================
  async update(id, data, tenantId = null) {
    const values = [
      data.final_price,
      data.gcs_storage_path || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.quotation_template_metadata_id || null,
      id
    ];
    let sql = `
      UPDATE proposal_draft
      SET
        final_price = $1,
        gcs_storage_path = $2,
        metadata = $3,
        quotation_template_metadata_id = $4,
        updated_at = now()
      WHERE id = $5
    `;
    if (tenantId) {
      values.push(tenantId);
      sql += ` AND tenant_id = $6`;
    }
    sql += ` RETURNING *;`;

    const result = await AppDataSource.query(sql, values);
    return result[0];
  }

  // =====================================================
  // SOFT DELETE
  // =====================================================
  async softDelete(id, tenantId = null) {
    const params = [id];
    let sql = `
      UPDATE proposal_draft
      SET is_deleted = true,
          updated_at = now()
      WHERE id = $1
    `;
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $2`;
    }
    sql += ` RETURNING *;`;

    const result = await AppDataSource.query(sql, params);
    return result[0];
  }
}

module.exports = new ProposalDraftRepository();
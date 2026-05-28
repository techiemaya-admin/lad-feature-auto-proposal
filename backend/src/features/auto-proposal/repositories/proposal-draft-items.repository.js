const AppDataSource = require("../../../config/data-source");

class ProposalDraftItemsRepository {

  // =====================================================
  // BULK INSERT ITEMS (LITE/IMPACT Breakdown)
  // =====================================================
  async bulkCreate(items) {
    console.log("Bulk creating proposal draft items:", items);
    if (!items || items.length === 0) return [];

    const values = [];
    const placeholders = items.map((item, index) => {
      // We have 7 columns, so the offset for each row is index * 7
      const offset = index * 7;

      values.push(
        item.tenant_id,          // $1, $8, $15...
        item.proposal_draft_id,  // $2, $9, $16...
        item.concept_name,       // $3, $10...
        item.label,              // $4, $11...
        item.unit_count,         // $5, $12...
        item.total_price,        // $6, $13...
        JSON.stringify(item.applied_rules || []) // $7, $14, $21...
      );

      // Generate ($1, $2, $3, $4, $5, $6, $7), then ($8, $9, $10...)
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    }).join(",");

    const sql = `
    INSERT INTO proposal_draft_items 
    (tenant_id, proposal_draft_id, concept_name, label, unit_count, total_price, applied_rules)
    VALUES ${placeholders}
    RETURNING *;
  `;

    try {
      const result = await AppDataSource.query(sql, values);
      return result;
    } catch (error) {
      console.error("Query failed during bulk create:", error);
      throw error;
    }
  }

  // =====================================================
  // GET ALL ITEMS FOR A PROPOSAL (For UI Rendering)
  // =====================================================
  async findByProposalDraftId(proposalDraftId) {
    const sql = `
      SELECT * FROM proposal_draft_items 
      WHERE proposal_draft_id = $1 
      ORDER BY concept_name ASC, id ASC;
    `;

    return await AppDataSource.query(sql, [proposalDraftId]);
  }


  // =====================================================
  // DELETE ALL ITEMS (If re-calculating a draft)
  // =====================================================
  async deleteByProposalId(proposalDraftId) {
    const sql = `
      DELETE FROM proposal_draft_items 
      WHERE proposal_draft_id = $1 
      RETURNING *;
    `;

    return await AppDataSource.query(sql, [proposalDraftId]);
  }

  async findItemsByMessageId(proposalDraftId) {
    const sql = `
    SELECT requirement_config_id 
    FROM proposal_draft_items 
    WHERE proposal_draft_id = $1
  `;
    const result = await AppDataSource.query(sql, [proposalDraftId]);
    return Array.isArray(result) ? result : result.rows || [];
  }
}

module.exports = new ProposalDraftItemsRepository();
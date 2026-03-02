const AppDataSource = require("../../../config/data-source");

class LeadRepository {

  async findByLeadRequirementId(leadRequirementId) {
    const sql = `
      SELECT l.*
      FROM lead_requirement lr
      JOIN leads l ON l.id = lr.lead_id
      WHERE lr.id = $1
      AND l.is_deleted = false;
    `;
    const result = await AppDataSource.query(sql, [leadRequirementId]);
    return result[0];
  }

}

module.exports = new LeadRepository();
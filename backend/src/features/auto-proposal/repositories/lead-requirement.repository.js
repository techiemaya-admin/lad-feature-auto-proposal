const AppDataSource = require("../../../config/data-source");

class LeadRequirementRepository {

  async create(data) {
    console.log("Creating lead requirement with data:", data);
    const sql = `
      INSERT INTO lead_requirement
      (tenant_id, lead_id, metadata, location, event_type, duration, event_category, services_requested, client_type, inquiry_type, support_level)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
    `;

    const values = [
      data.tenant_id || "550e8400-e29b-41d4-a716-446655440001",
      data.lead_id ||"660e8400-e29b-41d4-a716-446655440001",
      data || {},
      data.location,
      data.event_type,
      data.duration,
      data.event_category,
      JSON.stringify(data.services_requested) || [],
      data.client_type || null,
      data.inquiry_type || null,
      data.support_level || null
    ];

    const result = await AppDataSource.query(sql, values);
    console.log("Lead requirement created with ID:", result[0].id);
    return result[0];
  }

  async findById(id) {
    const sql = `
      SELECT *
      FROM lead_requirement
      WHERE id = $1 AND is_deleted = false;
    `;

    const result = await AppDataSource.query(sql, [id]);
    return result[0];
  }

  async findByLeadId(leadId) {
    const sql = `
      SELECT *
      FROM lead_requirement
      WHERE lead_id = $1 AND is_deleted = false
      ORDER BY created_at DESC;
    `;

    return await AppDataSource.query(sql, [leadId]);
  }

  async update(id, data) {
    const sql = `
      UPDATE lead_requirement
      SET
        metadata = $1,
        location = $2,
        event_type = $3,
        duration = $4,
        pax = $5,
        status = $6,
        updated_at = now()
      WHERE id = $7
      RETURNING *;
    `;

    const values = [
      data.metadata,
      data.location,
      data.event_type,
      data.duration,
      data.pax,
      data.status,
      id
    ];

    const result = await AppDataSource.query(sql, values);
    return result[0];
  }

  async softDelete(id) {
    const sql = `
      UPDATE lead_requirement
      SET is_deleted = true,
          updated_at = now()
      WHERE id = $1
      RETURNING *;
    `;

    const result = await AppDataSource.query(sql, [id]);
    return result[0];
  }
}

module.exports = new LeadRequirementRepository();

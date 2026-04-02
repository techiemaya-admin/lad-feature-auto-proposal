const AppDataSource = require("../../../config/data-source");

class LeadRepository {
  /**
   * Create a new Lead with full schema support
   */
  async create(data) {
  // 1. Check if email is provided
  if (data.email) {
    const checkSql = `
      SELECT * FROM leads 
      WHERE email = $1 AND tenant_id = $2 AND is_deleted = false 
      LIMIT 1`;
    
    const existingLeads = await AppDataSource.query(checkSql, [data.email, data.tenant_id]);

    // 2. If lead exists, return the existing lead instead of creating a new one
    if (existingLeads && existingLeads.length > 0) {
      console.log(`Lead with email ${data.email} already exists for tenant ${data.tenant_id}. Skipping creation.`);
      return existingLeads[0];
    }
  }

  // 3. If no existing lead found, proceed with insertion
  const sql = `
    INSERT INTO leads 
    (
      user_id, tenant_id, source, source_id, first_name, last_name, 
      email, phone, company_name, company_domain, title, linkedin_url, 
      location, status, priority, stage, tags, custom_fields, notes, 
      raw_data, created_by_user_id, assigned_user_id, estimated_value, 
      currency, country_code, base_number, apollo_person_id, 
      phone_type, phone_confidence
    ) 
    VALUES 
    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29) 
    RETURNING *`;

  const values = [
    data.user_id || null,
    data.tenant_id,
    data.source || null,
    data.source_id || null,
    data.first_name || null,
    data.last_name || null,
    data.email || null,
    data.phone || null,
    data.company_name || null,
    data.company_domain || null,
    data.title || null,
    data.linkedin_url || null,
    data.location || null,
    data.status || 'active',
    data.priority || 0,
    data.stage || 'new',
    data.tags ? JSON.stringify(data.tags) : '[]',
    data.custom_fields ? JSON.stringify(data.custom_fields) : '{}',
    data.notes || null,
    data.raw_data ? JSON.stringify(data.raw_data) : null,
    data.created_by_user_id || null,
    data.assigned_user_id || null,
    data.estimated_value || 0,
    data.currency || 'USD',
    data.country_code || null,
    data.base_number || null,
    data.apollo_person_id || null,
    data.phone_type || null,
    data.phone_confidence || null
  ];

  const result = await AppDataSource.query(sql, values);
  return result[0];
}
  /**
   * Fetch all leads for a specific tenant (excluding deleted)
   */
  async findByTenant(tenantId) {
    const sql = `
      SELECT * FROM leads 
      WHERE tenant_id = $1 AND is_deleted = false 
      ORDER BY created_at DESC
    `;
    const result = await AppDataSource.query(sql, [tenantId]);
    return result;
  }

  /**
   * Fetch a lead by its ID and Tenant
   */
  async findById(id, tenantId) {
    const sql = `
      SELECT * FROM leads 
      WHERE id = $1 AND tenant_id = $2 AND is_deleted = false
    `;
    const result = await AppDataSource.query(sql, [id, tenantId]);
    return result[0];
  }

  /**
   * Original method updated with tenant protection
   */
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

  /**
   * Update lead details
   */
  async update(id, tenantId, data) {
    const sql = `
      UPDATE leads 
      SET 
        first_name = $1, last_name = $2, email = $3, phone = $4, 
        status = $5, stage = $6, priority = $7, tags = $8, 
        custom_fields = $9, updated_at = NOW()
      WHERE id = $10 AND tenant_id = $11 AND is_deleted = false
      RETURNING *`;

    const values = [
      data.first_name,
      data.last_name,
      data.email,
      data.phone,
      data.status,
      data.stage,
      data.priority,
      data.tags ? JSON.stringify(data.tags) : '[]',
      data.custom_fields ? JSON.stringify(data.custom_fields) : '{}',
      id,
      tenantId
    ];

    const result = await AppDataSource.query(sql, values);
    return result[0];
  }

  /**
   * Soft Delete (Sets is_deleted = true)
   */
  async softDelete(id, tenantId) {
    const sql = `
      UPDATE leads SET is_deleted = true, updated_at = NOW() 
      WHERE id = $1 AND tenant_id = $2 
      RETURNING *`;
    const result = await AppDataSource.query(sql, [id, tenantId]);
    return result[0];
  }
}

module.exports = new LeadRepository();
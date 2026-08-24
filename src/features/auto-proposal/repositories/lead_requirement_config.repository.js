const db = require("../../../config/data-source");

class LeadRequirementConfigRepository {
  /**
   * Create a new config
   * Updated: Added base_price and pricing_model_id
   */
  async create(data) {
    console.log("Creating lead requirement config with data:", data);
    const sql = `
      INSERT INTO lead_requirement_config 
      (tenant_id, field_key, label, is_active,base_price, pricing_model_id) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`;

    const values = [
      data.tenant_id,
      data.field_key,
      data.label,
      data.is_active ?? true,
      data.base_price || 0,          // New field
      data.pricing_model_id || null  // New field
    ];

    const result = await db.query(sql, values);

    if (result && result.length > 0) {
      return result[0];
    }
    return null;
  }

  /**
   * NEW: Fetch configs specifically mapped to a Concept
   * Uses the simple mapping table you created
   */
  async findByConcept(conceptId) {
    const sql = `
      SELECT lrc.* FROM lead_requirement_config lrc
      JOIN concept_requirement_config_mapping crcm ON lrc.id = crcm.requirement_config_id
      WHERE crcm.concept_id = $1 AND lrc.is_active = true
    `;
    return await db.query(sql, [conceptId]);
  }

  /**
   * Fetch all configs for a tenant
   */
  async findByTenant(tenant_id) {
    const sql = `SELECT * FROM lead_requirement_config WHERE tenant_id=$1`;
    return await db.query(sql, [tenant_id]);
  }

  /**
   * Update an existing config
   * Updated: Added base_price and pricing_model_id
   */
  async update(id, data) {
    const sql = `
      UPDATE lead_requirement_config
      SET label=$1, field_key=$2, is_active=$3, base_price=$4, pricing_model_id=$5
      WHERE id=$6 
      RETURNING *`;

    const values = [
      data.label,
      data.field_key,
      data.is_active,
      data.base_price,      // New field
      data.pricing_model_id, // New field
      id
    ];

    const result = await db.query(sql, values);
    return result[0];
  }

  /**
   * NEW: Add a mapping between a concept and a requirement config
   */
  async addMappingToConcept(conceptId, requirementConfigId) {
    const sql = `
      INSERT INTO concept_requirement_config_mapping (concept_id, requirement_config_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING *`;
    const result = await db.query(sql, [conceptId, requirementConfigId]);
    return result[0];
  }

  /**
   * NEW: Remove a mapping between a concept and a requirement config
   */
  async removeMappingFromConcept(conceptId, requirementConfigId) {
    const sql = `
      DELETE FROM concept_requirement_config_mapping 
      WHERE concept_id = $1 AND requirement_config_id = $2
    `;
    await db.query(sql, [conceptId, requirementConfigId]);
  }

  async deactivate(id) {
    await db.query(
      `UPDATE lead_requirement_config SET is_active=false WHERE id=$1`,
      [id]
    );
  }

  async delete(id) {
    const result = await db.query(
      `DELETE FROM lead_requirement_config WHERE id = $1 RETURNING *`,
      [id]
    );
    return result[0];
  }

  async getFieldKeysAsString(tenantId) {
    try {
      const sql = `
        SELECT string_agg(field_key, ', ') as keys
        FROM lead_requirement_config
        WHERE tenant_id = $1 AND is_active = true
      `;
      const result = await db.query(sql, [tenantId]);
      return result[0]?.keys || "";
    } catch (error) {
      console.error("Error fetching field keys string:", error);
      return "";
    }
  }

  async findIdByFieldKey(tenantId, fieldKey) {
    try {
      const sql = `
        SELECT id 
        FROM lead_requirement_config 
        WHERE tenant_id = $1 
        AND id = $2 
        AND is_active = true
        LIMIT 1
      `;
      const result = await db.query(sql, [tenantId, fieldKey]);
      return result[0]?.id || null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Fetch only active configs for a tenant
   */
  async findByTenantAndActive(tenant_id) {
    const sql = `SELECT * FROM lead_requirement_config WHERE tenant_id=$1 AND is_active=true `;
    const result = await db.query(sql, [tenant_id]);
    return result;
  }
}

module.exports = new LeadRequirementConfigRepository();
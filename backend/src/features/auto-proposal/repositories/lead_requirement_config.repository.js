const db = require("../../../config/data-source");

class LeadRequirementConfigRepository {
  /**
   * Create a new config
   */
  async create(data) {
    console.log("Creating lead requirement config with data:", data);
    const sql = `
      INSERT INTO lead_requirement_config 
      (tenant_id, field_key, label, is_active, default_value, order_index) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`;

    const values = [
      data.tenant_id,
      data.field_key,
      data.label,
      data.is_active ?? true,
      data.default_value ? JSON.stringify(data.default_value) : null,
      data.order_index || 0
    ];

    const result = await db.query(sql, values);
    
    if (result && result.length > 0) {
      console.log("Lead requirement config created:", result[0]);
      return result[0];
    }
    return null;
  }

  /**
   * Fetch all configs for a tenant
   */
  async findByTenant(tenant_id) {
    console.log("Fetching lead requirement configs for tenant_id:", tenant_id);
    const sql = `SELECT * FROM lead_requirement_config WHERE tenant_id=$1 ORDER BY order_index ASC`;
    const result = await db.query(sql, [tenant_id]);
    return result;
  }

  /**
   * Fetch only active configs for a tenant
   */
  async findByTenantAndActive(tenant_id) {
    const sql = `SELECT * FROM lead_requirement_config WHERE tenant_id=$1 AND is_active=true ORDER BY order_index ASC`;
    const result = await db.query(sql, [tenant_id]);
    return result;
  }

  /**
   * Update an existing config
   */
  async update(id, data) {
    const sql = `
      UPDATE lead_requirement_config
      SET label=$1, field_key=$2, is_active=$3, default_value=$4, order_index=$5
      WHERE id=$6 
      RETURNING *`;
    
    const values = [
      data.label,
      data.field_key,
      data.is_active,
      data.default_value ? JSON.stringify(data.default_value) : null,
      data.order_index,
      id
    ];

    const result = await db.query(sql, values);
    return result[0];
  }

  /**
   * Soft delete (Deactivate)
   */
  async deactivate(id) {
    await db.query(
      `UPDATE lead_requirement_config SET is_active=false WHERE id=$1`,
      [id]
    );
  }

  /**
   * Hard delete (Permanent)
   */
  async delete(id) {
    const result = await db.query(
      `DELETE FROM lead_requirement_config WHERE id = $1 RETURNING *`,
      [id]
    );
    return result[0];
  }

  /**
   * NEW: Fetches field_keys as a comma-separated string
   * Example: "duration, budget, location"
   */
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
        AND field_key = $2 
        AND is_active = true
        LIMIT 1
      `;
      
      const result = await db.query(sql, [tenantId, fieldKey]);
      
      // Return the ID if found, otherwise return null
      return result[0]?.id || null;
    } catch (error) {
      console.error(`Error fetching ID for field_key: ${fieldKey}`, error);
      return null;
    }
  }
}

// Export an instance of the class
module.exports = new LeadRequirementConfigRepository();
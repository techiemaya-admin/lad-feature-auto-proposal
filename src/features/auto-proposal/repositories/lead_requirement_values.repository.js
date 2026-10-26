const db = require("../../../config/data-source");
const leadRequirementConfigRepo = require("./lead_requirement_config.repository");
const logger = require('../../../utils/logger');

class LeadRequirementValuesRepository {
  /**
   * Create a new value entry
   */
  async saveRequirementValues(tenantId, leadRequirementId, dynamic_requirements) {
    const keys = Object.keys(dynamic_requirements);

    // 1. Fetch all configs for this tenant ONCE to avoid multiple DB calls
    const configs = await leadRequirementConfigRepo.findByTenant(tenantId);

    // Create a quick lookup map: { "catering_count": "uuid-123" }
    const fieldKeyMap = configs.reduce((acc, config) => {
      acc[config.field_key] = config.id;
      return acc;
    }, {});

    const results = [];

    // 2. Use a transaction or batch if your DB driver supports it
    for (const key of keys) {
      const value = dynamic_requirements[key];
      const fieldId = fieldKeyMap[key];

      if (!fieldId) {
        logger.warn(`Field key "${key}" not found for tenant ${tenantId}. Skipping.`);
        continue;
      }

      // 3. Prepare data object
      const valueData = {
        lead_requirement_id: leadRequirementId,
        field_id: fieldId,
        value_text: null,
        value_number: null,
        value_json: null
      };

      // 4. Type detection
      if (value === null || value === undefined) continue;

      if (typeof value === 'number') {
        // It's already a true number
        valueData.value_number = value;
      } else if (typeof value === 'string' && value.trim() !== '' && !isNaN(value)) {
        // It's a string that CAN be a number (e.g., '100')
        valueData.value_number = value.includes('.') ? parseFloat(value) : parseInt(value);
      } else if (typeof value === 'object') {
        // It's an object/array
        valueData.value_json = JSON.stringify(value);
      } else {
        // It's a true string (e.g., 'Dubai')
        valueData.value_text = String(value);
      }
      // 5. Save using your upsert method
      try {
        const savedValue = await this.upsert(valueData);
        results.push(savedValue);
      } catch (err) {
        logger.error(`Error upserting key ${key}:`, err);
      }
    }

    return results;
  }
  /**
   * True when the lead requirement belongs to the tenant (and, if given, the field is one of the tenant's configs).
   */
  async belongsToTenant(leadRequirementId, tenantId, fieldId = null) {
    const sql = `
      SELECT 1
      FROM lead_requirement lr
      WHERE lr.id = $1 AND lr.tenant_id = $2
        AND ($3::uuid IS NULL OR EXISTS (
          SELECT 1 FROM lead_requirement_config c WHERE c.id = $3::uuid AND c.tenant_id = $2
        ))
      LIMIT 1`;
    const result = await db.query(sql, [leadRequirementId, tenantId, fieldId]);
    return result.length > 0;
  }

  async create(data) {
    const sql = `
      INSERT INTO lead_requirement_values 
      (lead_requirement_id, field_id, value_text, value_number, value_json) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *`;

    const values = [
      data.lead_requirement_id,
      data.field_id,
      data.value_text || null,
      data.value_number || null,
      data.value_json ? JSON.stringify(data.value_json) : null
    ];

    const result = await db.query(sql, values);
    return result[0];
  }

  /**
   * Fetch all values for a specific Lead Requirement
   * Joins with config to get the labels/keys
   */
  async findByRequirementId(leadRequirementId, tenantId) {
    const sql = `
      SELECT v.*, c.field_key, c.label 
      FROM lead_requirement_values v
      JOIN lead_requirement_config c ON v.field_id = c.id
      JOIN lead_requirement lr ON lr.id = v.lead_requirement_id
      WHERE v.lead_requirement_id = $1 AND lr.tenant_id = $2`;

    const result = await db.query(sql, [leadRequirementId, tenantId]);
    return result;
  }

  /**
   * Update a specific value by its ID
   */
  async update(id, data, tenantId) {
    const sql = `
      UPDATE lead_requirement_values v
      SET value_text = $1, value_number = $2, value_json = $3
      FROM lead_requirement lr
      WHERE v.id = $4 AND lr.id = v.lead_requirement_id AND lr.tenant_id = $5
      RETURNING v.*`;

    const values = [
      data.value_text || null,
      data.value_number || null,
      data.value_json ? JSON.stringify(data.value_json) : null,
      id,
      tenantId
    ];

    const result = await db.query(sql, values);
    return result[0];
  }

  /**
   * Upsert logic: Update if exists, otherwise Insert
   * Useful when saving a form where values might already exist
   */
  async upsert(data) {
    const sql = `
    INSERT INTO lead_requirement_values 
    (lead_requirement_id, field_id, value_text, value_number, value_json)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (lead_requirement_id, field_id) 
    DO UPDATE SET 
      value_text = EXCLUDED.value_text,
      value_number = EXCLUDED.value_number,
      value_json = EXCLUDED.value_json,
      created_at = NOW()
    RETURNING *`;

    const values = [
      data.lead_requirement_id,
      data.field_id,
      data.value_text || null,
      data.value_number || null,
      data.value_json ? JSON.stringify(data.value_json) : null
    ];

    const result = await db.query(sql, values);
    return result[0];
  }
  /**
   * Delete all values for a specific requirement
   */
  async deleteByRequirementId(leadRequirementId) {
    const sql = `DELETE FROM lead_requirement_values WHERE lead_requirement_id = $1`;
    await db.query(sql, [leadRequirementId]);
    return { success: true };
  }

  /**
   * Delete a single value entry
   */
  async delete(id, tenantId) {
    const sql = `
      DELETE FROM lead_requirement_values v
      USING lead_requirement lr
      WHERE v.id = $1 AND lr.id = v.lead_requirement_id AND lr.tenant_id = $2
      RETURNING v.*`;
    const result = await db.query(sql, [id, tenantId]);
    return result[0];
  }
}

module.exports = new LeadRequirementValuesRepository();
const db = require("../../../config/data-source");
const leadRequirementConfigRepo = require("./lead_requirement_config.repository");

class LeadRequirementValuesRepository {
  /**
   * Create a new value entry
   */
  async saveRequirementValues(tenantId, leadRequirementId, guestCounts) {
    // 1. Get the keys from the object (e.g., ["main_event", "catering"])
    const keys = Object.keys(guestCounts);
    console.log("Saving requirement values for tenant:", tenantId, "leadRequirementId:", leadRequirementId, "with guestCounts:", guestCounts);

    const results = [];

    for (const key of keys) {
      const value = guestCounts[key];
      console.log(`Processing key: ${key} with value: ${value}`);
      // 2. Find the field_id for this specific key and tenant
      const fieldId = await leadRequirementConfigRepo.findIdByFieldKey(tenantId, key);

      if (!fieldId) {
        console.warn(`Field key "${key}" not found in config for tenant ${tenantId}. Skipping.`);
        continue;
      }

      // 3. Prepare data object for the values repository
      const valueData = {
        lead_requirement_id: leadRequirementId,
        field_id: fieldId,
        value_text: null,
        value_number: null,
        value_json: null
      };

      // 4. Determine value type automatically
      if (typeof value === 'number') {
        valueData.value_number = value;
      } else if (typeof value === 'object') {
        valueData.value_json = value;
      } else {
        valueData.value_text = String(value);
      }

      // 5. Save (using upsert to prevent duplicates)
      const savedValue = await this.upsert(valueData);
      results.push(savedValue);
    }

    return results;
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
  async findByRequirementId(leadRequirementId) {
    const sql = `
      SELECT v.*, c.field_key, c.label 
      FROM lead_requirement_values v
      JOIN lead_requirement_config c ON v.field_id = c.id
      WHERE v.lead_requirement_id = $1
      ORDER BY c.order_index ASC`;

    const result = await db.query(sql, [leadRequirementId]);
    return result;
  }

  /**
   * Update a specific value by its ID
   */
  async update(id, data) {
    const sql = `
      UPDATE lead_requirement_values 
      SET value_text = $1, value_number = $2, value_json = $3
      WHERE id = $4 
      RETURNING *`;

    const values = [
      data.value_text || null,
      data.value_number || null,
      data.value_json ? JSON.stringify(data.value_json) : null,
      id
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
  async delete(id) {
    const sql = `DELETE FROM lead_requirement_values WHERE id = $1 RETURNING *`;
    const result = await db.query(sql, [id]);
    return result[0];
  }
}

module.exports = new LeadRequirementValuesRepository();
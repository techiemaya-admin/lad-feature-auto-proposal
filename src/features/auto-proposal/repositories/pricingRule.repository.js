const db = require("../../../config/data-source");
const lead_requirement_configRepository = require("./lead_requirement_config.repository");

class PricingRuleRepository {
  /**
   * Create a new pricing rule
   * Handles target_type: 'service' or 'package'
   */
  async create(data) {
    console.log("Creating pricing rule with data:", data);
    console.log("data.concept_id:", data.concept_id);
    console.log("data.requirement_config_id:", data.requirement_config_id);

    const requirement_config_id= data.target_type === 'service' ? await lead_requirement_configRepository.findIdByFieldKey(data.tenant_id,data.condition_field) : null;
    console.log("Derived requirement_config_id for service target:", requirement_config_id);
    const sql = `
      INSERT INTO pricing_rules 
      (
        tenant_id, name, target_type, concept_id, requirement_config_id, 
        priority, is_active, condition_field, condition_operator, 
        condition_value, action_type, action_mode, action_value, 
        action_value_type, metadata
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
      RETURNING *`;

    const values = [
      data.tenant_id,
      data.name,
      data.target_type, // 'service' or 'package'
      data.target_type === 'package' ? data.concept_id : null,
      data.target_type === 'service' ? requirement_config_id : null,
      data.priority || 1,
      data.is_active ?? true,
      data.target_type === 'service' ? data.condition_field : null,
      data.target_type === 'service' ? data.condition_operator : null,
      data.target_type === 'service' ? data.condition_value : null,
      data.action_type,
      data.action_mode,
      data.action_value,
      data.action_value_type,
      data.metadata ? JSON.stringify(data) : null
    ];

    const result = await db.query(sql, values);
    return result[0] || null;
  }

  /**
   * Fetch all active rules for a tenant
   */
  async findAll(tenantId) {
    const sql = `
      SELECT pr.*, 
             c.name as concept_name, 
             lrc.label as service_label,
             c.id as concept_id,
              lrc.id as requirement_config_id
      FROM pricing_rules pr
      LEFT JOIN concept c ON pr.concept_id = c.id
      LEFT JOIN lead_requirement_config lrc ON pr.requirement_config_id = lrc.id
      WHERE pr.tenant_id = $1 AND pr.is_deleted = false
      ORDER BY pr.priority DESC, pr.created_at DESC
    `;
    const result = await db.query(sql, [tenantId]);
    return Array.isArray(result) ? result : result.rows || [];
  }


  async findAllWithConceptAndServiceDetails(tenantId) {
    const sql = `
      SELECT pr.*, 
             c.name as concept_name, 
             lrc.label as service_label,
             c.id as concept_id,
             lrc.id as requirement_config_id
      FROM pricing_rules pr
      LEFT JOIN concept c ON pr.concept_id = c.id
      LEFT JOIN lead_requirement_config lrc ON pr.requirement_config_id = lrc.id
      WHERE pr.tenant_id = $1 AND pr.is_deleted = false
      ORDER BY pr.priority DESC, pr.created_at DESC
    `;
    
    const result = await db.query(sql, [tenantId]);
    const rows = Array.isArray(result) ? result : result.rows || [];

    const conceptsMap = {};
    const standaloneRequirementsMap = {};

    for (const row of rows) {
      // Reassemble the rule data cleanly matching your architectural condition/action layout
      const pricingRule = {
        id: row.id,
        name: row.name,
        priority: row.priority,
        is_active: row.is_active,
        target_type: row.target_type,
        
        // Formatted Condition Sub-object
        condition: row.condition_field ? {
          field: row.condition_field,
          operator: row.condition_operator,
          value: row.condition_value ? Number(row.condition_value) : null
        } : null,
        
        // Formatted Action Sub-object
        action: row.action_type ? {
          type: row.action_type,            // e.g., 'discount', 'surcharge'
          mode: row.action_mode,            // e.g., 'subtract', 'add', 'set'
          value: row.action_value ? Number(row.action_value) : null,
          value_type: row.action_value_type // e.g., 'fixed', 'percentage'
        } : null,
        
        metadata: row.metadata,
        created_at: row.created_at,
        updated_at: row.updated_at
      };

      // 1. Group by package concept rules
      if (row.target_type === 'package' && row.concept_id) {
        if (!conceptsMap[row.concept_id]) {
          conceptsMap[row.concept_id] = {
            concept_id: row.concept_id,
            concept_name: row.concept_name || 'Unnamed Package Concept',
            pricing_rules: []
          };
        }
        conceptsMap[row.concept_id].pricing_rules.push(pricingRule);

      // 2. Group by standalone service rules
      } else if (row.target_type === 'service' && row.requirement_config_id) {
        if (!standaloneRequirementsMap[row.requirement_config_id]) {
          standaloneRequirementsMap[row.requirement_config_id] = {
            requirement_config_id: row.requirement_config_id,
            service_label: row.service_label || 'Unnamed Service Requirement',
            pricing_rules: []
          };
        }
        standaloneRequirementsMap[row.requirement_config_id].pricing_rules.push(pricingRule);
      }
    }

    // Convert the dictionary tracking maps to arrays to easily send to your frontend UI or AI context parser
    return {
      concepts: Object.values(conceptsMap),
      standaloneRequirements: Object.values(standaloneRequirementsMap)
    };
  }

  /**
   * Fetch rules specific to a target (e.g., when calculating price for a Concept)
   */
  async findByTarget(tenantId, targetType, targetId) {
    let column = targetType === 'package' ? 'concept_id' : 'requirement_config_id';

    const sql = `
      SELECT * FROM pricing_rules 
      WHERE tenant_id = $1 
      AND target_type = $2 
      AND ${column} = $3 
      AND is_active = true 
      AND is_deleted = false
      ORDER BY priority DESC
    `;

    const result = await db.query(sql, [tenantId, targetType, targetId]);
    return result;
  }

  /**
   * Update a pricing rule
   */
  async update(id, data) {
    console.log("Updating pricing rule with id : " + id + " data:", data);
    const sql = `
      UPDATE pricing_rules
      SET 
        name = COALESCE($1, name),
        target_type = COALESCE($2, target_type),
        concept_id = $3,
        requirement_config_id = $4,
        priority = COALESCE($5, priority),
        is_active = COALESCE($6, is_active),
        condition_field = COALESCE($7, condition_field),
        condition_operator = COALESCE($8, condition_operator),
        condition_value = COALESCE($9, condition_value),
        action_type = COALESCE($10, action_type),
        action_mode = COALESCE($11, action_mode),
        action_value = COALESCE($12, action_value),
        action_value_type = COALESCE($13, action_value_type),
        metadata = COALESCE($14, metadata),
        updated_at = NOW()
      WHERE id = $15
      RETURNING *`;

    const values = [
      data.name,
      data.target_type,
      data.target_type === 'package' ? data.concept_id : null,
      data.target_type === 'service' ? data.requirement_config_id : null,
      data.priority,
      data.is_active,
      data.condition_field,
      data.condition_operator,
      data.condition_value,
      data.action_type,
      data.action_mode,
      data.action_value,
      data.action_value_type,
      data.metadata ? JSON.stringify(data.metadata) : null,
      id
    ];

    const result = await db.query(sql, values);
    return result[0] || null;
  }

  async delete(id) {
    const sql = `DELETE FROM pricing_rules WHERE id = $1 RETURNING id`;
    const result = await db.query(sql, [id]);
    return result[0] || null;
  }
  
  /**
   * Soft delete a rule
   */
  async softDelete(id, tenantId) {
    const sql = `
      UPDATE pricing_rules 
      SET is_deleted = true, updated_at = NOW() 
      WHERE id = $1 AND tenant_id = $2
      RETURNING id`;
    const result = await db.query(sql, [id, tenantId]);
    return result[0] || null;
  }
}

module.exports = new PricingRuleRepository();
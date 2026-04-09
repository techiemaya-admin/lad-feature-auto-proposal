const db = require('../../../config/data-source');

exports.create = async (data) => {
    const query = `
    INSERT INTO pricing_rules (
      concept_id, name, priority, is_active,
      condition_field, condition_operator, condition_value,
      action_type, action_mode, action_value, action_value_type,
      tenant_id, metadata
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *;
  `;

    const values = [
        data.concept_id,
        data.name,
        data.priority,
        data.is_active,
        data.condition_field,
        data.condition_operator,
        data.condition_value,
        data.action_type,
        data.action_mode,
        data.action_value,
        data.action_value_type,
        data.tenant_id,
        data.metadata || {}
    ];

    const result = await db.query(query, values);
    return result[0];
};

exports.findAll = async (tenant_id) => {
    const query = `
    SELECT * FROM pricing_rules
    WHERE tenant_id = $1 AND is_deleted = false
    ORDER BY priority ASC
  `;
    const result = await db.query(query, [tenant_id]);
    return result;
};

exports.findById = async (id, tenant_id) => {
    const query = `
    SELECT * FROM pricing_rules
    WHERE id = $1 AND tenant_id = $2 AND is_deleted = false
  `;
    const result = await db.query(query, [id, tenant_id]);
    return result[0];
};

exports.update = async (id, data) => {
    const query = `
    UPDATE pricing_rules SET
      name=$1,
      priority=$2,
      is_active=$3,
      condition_field=$4,
      condition_operator=$5,
      condition_value=$6,
      action_type=$7,
      action_mode=$8,
      action_value=$9,
      action_value_type=$10,
      metadata=$11,
      updated_at=now()
    WHERE id=$12 AND tenant_id=$13
    RETURNING *;
  `;

    const values = [
        data.name,
        data.priority,
        data.is_active,
        data.condition_field,
        data.condition_operator,
        data.condition_value,
        data.action_type,
        data.action_mode,
        data.action_value,
        data.action_value_type,
        data.metadata || {},
        id,
        data.tenant_id
    ];

    const result = await db.query(query, values);
    return result[0];
};

exports.delete = async (id) => {
    console.log('Soft deleting pricing rule with ID:', id);
    const query = `
    UPDATE pricing_rules
    SET is_deleted = true, updated_at = now()
    WHERE id = $1
  `;
    await db.query(query, [id]);
};
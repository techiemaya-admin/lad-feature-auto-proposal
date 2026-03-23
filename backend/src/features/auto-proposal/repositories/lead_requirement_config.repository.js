const db = require("../config/db");

exports.create = async (data) => {
  const result = await db.query(
    `INSERT INTO lead_requirement_config
     (tenant_id, field_key, label, field_type, is_required, options)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      data.tenant_id,
      data.field_key,
      data.label,
      data.field_type,
      data.is_required,
      data.options || null
    ]
  );
  return result.rows[0];
};

exports.findByTenant = async (tenant_id) => {
  const result = await db.query(
    `SELECT * FROM lead_requirement_config
     WHERE tenant_id=$1 AND is_active=true`,
    [tenant_id]
  );
  return result.rows;
};

exports.update = async (id, data) => {
  const result = await db.query(
    `UPDATE lead_requirement_config
     SET label=$1, field_type=$2, is_required=$3, options=$4
     WHERE id=$5 RETURNING *`,
    [data.label, data.field_type, data.is_required, data.options, id]
  );
  return result.rows[0];
};

exports.deactivate = async (id) => {
  await db.query(
    `UPDATE lead_requirement_config SET is_active=false WHERE id=$1`,
    [id]
  );
};
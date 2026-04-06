const db = require('../db/db');

exports.create = async (data) => {
  const query = `
    INSERT INTO pricing_models (type, tenant_id, metadata)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const values = [data.type, data.tenant_id, data.metadata || {}];
  const result = await db.query(query, values);
  return result.rows[0];
};

exports.findAll = async (tenant_id) => {
  const query = `
    SELECT * FROM pricing_models
    WHERE tenant_id = $1 AND is_deleted = false
    ORDER BY created_at DESC
  `;
  const result = await db.query(query, [tenant_id]);
  return result.rows;
};

exports.findById = async (id, tenant_id) => {
  const query = `
    SELECT * FROM pricing_models
    WHERE id = $1 AND tenant_id = $2 AND is_deleted = false
  `;
  const result = await db.query(query, [id, tenant_id]);
  return result.rows[0];
};

exports.update = async (id, data) => {
  const query = `
    UPDATE pricing_models
    SET type = $1,
        metadata = $2,
        updated_at = now()
    WHERE id = $3 AND tenant_id = $4
    RETURNING *;
  `;
  const values = [data.type, data.metadata || {}, id, data.tenant_id];
  const result = await db.query(query, values);
  return result.rows[0];
};

exports.delete = async (id, tenant_id) => {
  const query = `
    UPDATE pricing_models
    SET is_deleted = true, updated_at = now()
    WHERE id = $1 AND tenant_id = $2
  `;
  await db.query(query, [id, tenant_id]);
};
const db = require("../config/db");

exports.bulkInsert = async (lead_requirement_id, values) => {
  const promises = values.map(v =>
    db.query(
      `INSERT INTO lead_requirement_values
       (lead_requirement_id, field_id, value_text, value_number, value_json)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        lead_requirement_id,
        v.field_id,
        v.value_text || null,
        v.value_number || null,
        v.value_json || null
      ]
    )
  );

  await Promise.all(promises);
};

exports.findByLeadRequirement = async (id) => {
  const result = await db.query(
    `SELECT * FROM lead_requirement_values WHERE lead_requirement_id=$1`,
    [id]
  );
  return result.rows;
};

exports.update = async (id, data) => {
  const result = await db.query(
    `UPDATE lead_requirement_values
     SET value_text=$1, value_number=$2, value_json=$3
     WHERE id=$4 RETURNING *`,
    [data.value_text, data.value_number, data.value_json, id]
  );
  return result.rows[0];
};

exports.delete = async (id) => {
  await db.query(`DELETE FROM lead_requirement_values WHERE id=$1`, [id]);
};
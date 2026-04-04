const db = require("../../../config/data-source");

class ConceptRepository {
  /**
   * Create a new concept
   * Based on columns: tenant_id, name, marshal_ratio, minimum_cost, description, metadata
   */
  async create(tenantId, data) {
    const sql = `
      INSERT INTO concept 
      (tenant_id, name, marshal_ratio, minimum_cost, description, metadata) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`;

    const values = [
      tenantId,
      data.name,
      data.marshal_ratio || null,
      data.minimum_cost || 0,
      data.description || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    ];

    const result = await db.query(sql, values);
    return result[0] || null;
  }

  /**
   * Fetch a single concept by ID
   */
  async findById(tenantId, id) {
    const sql = `
      SELECT * FROM concept 
      WHERE id = $1 AND tenant_id = $2
    `;
    const result = await db.query(sql, [id, tenantId]);
    return result[0] || null;
  }

  /**
   * Fetch all active concepts for a tenant
   */
  async findAll(tenantId) {
    const sql = `
      SELECT * FROM concept 
      WHERE tenant_id = $1
      ORDER BY created_at DESC 
    `;
    return await db.query(sql, [tenantId]);
  }

  /**
   * Fetch concepts by a list of IDs
   */
  async findByIds(tenantId, ids) {
    if (!ids || ids.length === 0) return [];
    const sql = `
      SELECT * FROM concept 
      WHERE tenant_id = $1 AND id = ANY($2)
    `;
    return await db.query(sql, [tenantId, ids]);
  }

  /**
   * Update an existing concept
   */
  async update(tenantId, id, data) {
    const sql = `
      UPDATE concept
      SET 
        name = COALESCE($1, name),
        marshal_ratio = COALESCE($2, marshal_ratio),
        minimum_cost = COALESCE($3, minimum_cost),
        description = COALESCE($4, description),
        metadata = COALESCE($5, metadata),
        updated_at = NOW()
      WHERE id = $6 AND tenant_id = $7 
      RETURNING *`;

    const values = [
      data.name,
      data.marshal_ratio,
      data.minimum_cost,
      data.description,
      data.metadata ? JSON.stringify(data.metadata) : null,
      id,
      tenantId
    ];

    const result = await db.query(sql, values);
    return result[0] || null;
  }

  /**
   * Soft delete a concept
   */
  async softDelete(tenantId, id) {
    const sql = `
      UPDATE concept 
      SET is_deleted = true, updated_at = NOW() 
      WHERE id = $1 AND tenant_id = $2 
      RETURNING id
    `;
    const result = await db.query(sql, [id, tenantId]);
    return result[0] || null;
  }
  /**
     * Hard delete a concept (Permanent removal)
     */
  async hardDelete(id) {
    const sql = `
      DELETE FROM concept 
      WHERE id = $1
      RETURNING id
    `;
    const result = await db.query(sql, [id]);

    // Return the deleted ID if successful, otherwise null
    return result[0] || null;
  }
}


module.exports = new ConceptRepository();
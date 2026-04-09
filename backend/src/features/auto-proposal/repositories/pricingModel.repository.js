const db = require("../../../config/data-source");

class PricingModelRepository {
    /**
     * Create a new pricing model
     */
    async create(data) {
        const sql = `
      INSERT INTO pricing_models (type, tenant_id, metadata)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
        const values = [
            data.type,
            data.tenant_id,
            data.metadata || {}
        ];

        const result = await db.query(sql, values);

        if (result && result.length > 0) {
            return result[0];
        }
        return null;
    }

    /**
     * Fetch all active pricing models for a tenant
     */
    async findAll(tenantId) {
        const sql = `
      SELECT id, type,label, metadata 
      FROM pricing_models 
      WHERE tenant_id = $1 AND is_deleted = false
      ORDER BY type ASC
    `;
        const result = await db.query(sql, [tenantId]);

        // Ensure we return an array even if the driver returns an object wrapper [cite: 23]
        const rows = Array.isArray(result) ? result : result.rows || [];

        // Map the raw types to the labels expected by your UI 
        return rows.map(row => ({
            value: row.type,
            label: row.label
        }));
    }

    /**
     * Find a specific pricing model by ID and tenant
     */
    async findById(id, tenant_id) {
        const sql = `
      SELECT * FROM pricing_models
      WHERE id = $1 AND tenant_id = $2 AND is_deleted = false
    `;
        const result = await db.query(sql, [id, tenant_id]);
        return result[0] || null;
    }

    /**
     * Update an existing pricing model
     */
    async update(id, data) {
        const sql = `
      UPDATE pricing_models
      SET type = $1,
          metadata = $2,
          updated_at = now()
      WHERE id = $3 AND tenant_id = $4
      RETURNING *;
    `;
        const values = [
            data.type,
            data.metadata || {},
            id,
            data.tenant_id
        ];

        const result = await db.query(sql, values);
        return result[0] || null;
    }

    /**
     * Soft delete a pricing model
     */
    async delete(id, tenant_id) {
        const sql = `
      UPDATE pricing_models
      SET is_deleted = true, updated_at = now()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *;
    `;
        const result = await db.query(sql, [id, tenant_id]);
        return result[0] || null;
    }
}

// Export an instance of the class
module.exports = new PricingModelRepository();
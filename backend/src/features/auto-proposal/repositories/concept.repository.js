const db = require("../../../config/data-source");

class ConceptRepository {
  /**
   * Create a new concept
   * Based on columns: tenant_id, name, marshal_ratio, minimum_cost, description, metadata
   */
  async create(tenantId, data) {
    console.log(`Creating concept for tenant ${tenantId} with data:`, data);
    const pricingModelType = data.pricing_type || null; // Ensure we have a value for pricing_model_id
    const pricingModelId = await this.resolvePricingModelId(tenantId, pricingModelType);
    console.log(`Pricing model with type ${pricingModelId} validated for tenant ${tenantId}`);

    const sql = `
      INSERT INTO concept 
      (tenant_id, name, base_price, minimum_cost, description, metadata,pricing_model_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *`;

    const values = [
      tenantId,
      data.name,
      data.base_price || null,
      data.minimum_cost || 0,
      data.description || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      pricingModelId
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
      WHERE id = $1 AND tenant_id = $2 AND is_deleted = false
    `;
    const result = await db.query(sql, [id, tenantId]);
    return result[0] || null;
  }

  /**
   * Fetch all active concepts for a tenant
   */
  async findAll(tenantId) {
    const sql = `
    SELECT 
      c.*,
      CASE 
        WHEN pm.id IS NOT NULL THEN 
          JSON_BUILD_OBJECT(
            'id', pm.id,
            'type', pm.type,
            'label', COALESCE(pm.metadata->>'custom_label', 
                        INITCAP(REPLACE(pm.type, '_', ' ')))
          )
        ELSE NULL 
      END as pricing_model
    FROM concept c
    LEFT JOIN pricing_models pm ON c.pricing_model_id = pm.id
    WHERE c.tenant_id = $1 AND c.is_deleted = false
    ORDER BY c.created_at DESC
  `;

    const result = await db.query(sql, [tenantId]);

    // Return the rows array (handling potential driver wrapper)
    return Array.isArray(result) ? result : result.rows || [];
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
    const pricingModelType = data.pricing_type || null; // Ensure we have a value for pricing_model_id
    const pricingModelId = await this.resolvePricingModelId(tenantId, pricingModelType);
    console.log(`Updating concept ${id} for tenant ${tenantId} with data:`, data, 
      `Resolved pricing model ID: ${pricingModelId}`);
    const sql = `
      UPDATE concept
      SET 
        name = COALESCE($1, name),
        base_price = COALESCE($2, base_price),
        minimum_cost = COALESCE($3, minimum_cost),
        description = COALESCE($4, description),
        metadata = COALESCE($5, metadata),
        pricing_model_id = COALESCE($6, pricing_model_id),
        updated_at = NOW()
      WHERE id = $7 AND tenant_id = $8 
      RETURNING *`;

    const values = [
      data.name,
      data.base_price,
      data.minimum_cost,
      data.description,
      data.metadata ? JSON.stringify(data.metadata) : null,
      pricingModelId,
      id,
      tenantId
    ];

    const result = await db.query(sql, values);
    return result[0] || null;
  }

  /**
   * Soft delete a concept
   */
  async softDelete(id) {
    const sql = `
      UPDATE concept 
      SET is_deleted = true, updated_at = NOW() 
      WHERE id = $1
      RETURNING id
    `;
    const result = await db.query(sql, [id]);
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

  /**
 * Helper to resolve a pricing_model_id from a string type (e.g., 'per_person')
 */
  async resolvePricingModelId(tenantId, pricingType) {
    if (!pricingType) return null;

    const query = `
    SELECT id FROM pricing_models 
    WHERE type = $1 AND tenant_id = $2 AND is_deleted = false 
    LIMIT 1
  `;

    const result = await db.query(query, [pricingType, tenantId]);
    const rows = Array.isArray(result) ? result : result.rows || [];

    return rows[0]?.id || null;
  }
}


module.exports = new ConceptRepository();
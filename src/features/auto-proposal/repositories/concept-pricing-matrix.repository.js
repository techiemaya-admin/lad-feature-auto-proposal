const db = require("../../../config/data-source");

class ConceptPricingMatrixRepository {
  async create(tenantId, data) {
    const sql = `
      INSERT INTO concept_pricing_matrix 
      (tenant_id, concept_id, price_per_person, min_pax, max_pax, discount_percentage, markup_percentage, location_id, metadata) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *`;

    const values = [
      tenantId,
      data.concept_id,
      data.price_per_person,
      data.min_pax || 1,
      data.max_pax || 1,
      data.discount_percentage || 0,
      data.markup_percentage || 0,
      data.location_id || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    ];

    const result = await db.query(sql, values);
    return result[0] || null;
  }

  async findByConcept(tenantId, conceptId) {
    const sql = `
      SELECT * FROM concept_pricing_matrix 
      WHERE tenant_id = $1 AND concept_id = $2 AND is_deleted = false 
      ORDER BY min_pax ASC`;
    const result = await db.query(sql, [tenantId, conceptId]);
    return Array.isArray(result) ? result : result.rows || [];
  }

  async update(tenantId, id, data) {
    const sql = `
      UPDATE concept_pricing_matrix
      SET 
        price_per_person = COALESCE($1, price_per_person),
        min_pax = COALESCE($2, min_pax),
        max_pax = COALESCE($3, max_pax),
        discount_percentage = COALESCE($4, discount_percentage),
        markup_percentage = COALESCE($5, markup_percentage),
        location_id = $6,
        metadata = COALESCE($7, metadata),
        updated_at = NOW()
      WHERE id = $8 AND tenant_id = $9
      RETURNING *`;

    const values = [
      data.price_per_person, data.min_pax, data.max_pax,
      data.discount_percentage, data.markup_percentage,
      data.location_id, data.metadata ? JSON.stringify(data.metadata) : null,
      id, tenantId
    ];

    const result = await db.query(sql, values);
    return result[0] || null;
  }

  async softDelete(tenantId, id) {
    const sql = `UPDATE concept_pricing_matrix SET is_deleted = true WHERE id = $1 AND tenant_id = $2 RETURNING id`;
    const result = await db.query(sql, [id, tenantId]);
    return result[0] || null;
  }

  async hardDelete(tenantId, id) {
    const sql = `DELETE FROM concept_pricing_matrix WHERE id = $1 AND tenant_id = $2 RETURNING id`;
    const result = await db.query(sql, [id, tenantId]);
    return result[0] || null; // Return deleted ID or null if not found
  }

  async getAllByTenant(tenantId) {
    const sql = `
      SELECT * FROM concept_pricing_matrix 
      WHERE tenant_id = $1
      ORDER BY concept_id, min_pax ASC`;
    const result = await db.query(sql, [tenantId]);
    return Array.isArray(result) ? result : result.rows || [];
  }
}

module.exports = new ConceptPricingMatrixRepository();
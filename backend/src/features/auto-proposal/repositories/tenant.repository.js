const AppDataSource = require("../../../config/data-source");
const { v4: uuidv4 } = require('uuid');

class TenantRepository {
  
  // =====================================================
  // CREATE TENANT
  // =====================================================
  async create(tenantData) {
    const id = uuidv4();
    const { name, slug, logo_url, settings } = tenantData;

    const sql = `
      INSERT INTO tenants (id, name, slug, logo_url, settings,  created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5,  NOW(), NOW())
      RETURNING *;
    `;

    const result = await AppDataSource.query(sql, [
      id,
      name,
      slug,
      logo_url,
      JSON.stringify(settings || {})
    ]);

    return result[0];
  }

  // =====================================================
  // FIND BY ID
  // =====================================================
  async findById(id) {
    const sql = `
      SELECT * FROM tenants 
      WHERE id = $1 ;
    `;

    const result = await AppDataSource.query(sql, [id]);
    return result[0] || null;
  }

  // =====================================================
  // FIND BY SLUG (Useful for subdomains/routing)
  // =====================================================
  async findBySlug(slug) {
    const sql = `
      SELECT * FROM tenants 
      WHERE slug = $1 ;
    `;

    const result = await AppDataSource.query(sql, [slug]);
    return result[0] || null;
  }

  // =====================================================
  // FIND ALL (With Pagination)
  // =====================================================
  async findAll(limit = 100, offset = 0) {
    const sql = `
      SELECT * FROM tenants 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2;
    `;

    return await AppDataSource.query(sql, [limit, offset]);
  }

  // =====================================================
  // UPDATE TENANT
  // =====================================================
  async update(id, updateData) {
    const fields = Object.keys(updateData);
    if (fields.length === 0) return null;

    const setClause = fields
      .map((field, index) => `${field} = $${index + 2}`)
      .join(", ");
    
    const values = [id, ...Object.values(updateData)];

    const sql = `
      UPDATE tenants 
      SET ${setClause}, updated_at = NOW() 
      WHERE id = $1 
      RETURNING *;
    `;

    const result = await AppDataSource.query(sql, values);
    return result[0];
  }
}

module.exports = new TenantRepository();
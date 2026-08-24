const AppDataSource = require("../../../config/data-source");

class QuotationTemplateRepository {

  async create(data) {
    const sql = `
      INSERT INTO quotation_template_metadata
      (
        tenant_id,
        name,
        type,
        storage_path,
        is_default,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const values = [
      data.tenant_id,
      data.name,
      data.type,
      data.storage_path,
      data.is_default ?? false,
      data.metadata || {}
    ];

    const result = await AppDataSource.query(sql, values);
    return result[0];
  }

  async findDefaultByTenant(tenantId) {
    const sql = `
      SELECT *
      FROM quotation_template_metadata
      WHERE tenant_id = $1 
        AND is_default = true 
        AND is_deleted = false
      LIMIT 1;
    `;

    const result = await AppDataSource.query(sql, [tenantId]);
    console.log("Default Quotation Template found for tenant:", tenantId, ":", result[0]);
    return result[0] || null;
  }


  async setAsDefault(tenant_id, templateId) {
    await this.resetDefaultsByTenant(tenant_id);
    const query = `UPDATE quotation_template_metadata
     SET is_default = true WHERE id = $1 AND tenant_id = $2 RETURNING *`;
    const rows = await AppDataSource.query(query, [templateId, tenant_id]);
    if (rows.length > 0) {
      return rows[0];
    } else {
      // If no profile exists, return a default structure with null values
      return null;
    }

  }

  async resetDefaultsByTenant(tenantId) {
    const sql = `
      UPDATE quotation_template_metadata
      SET 
        is_default = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1
      RETURNING *;
    `;

    const result = await AppDataSource.query(sql, [tenantId]);
    return result || [];
  }

  async deleteTemplate(templateId) {
    const sql = `
      UPDATE quotation_template_metadata
      SET 
        is_deleted = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;

    const result = await AppDataSource.query(sql, [templateId]);
    return result[0] || null;
  }

  async findById(templateId) {
    const sql = `
      SELECT *
      FROM quotation_template_metadata
      WHERE id = $1
      LIMIT 1;
    `;

    const result = await AppDataSource.query(sql, [templateId]);
    return result[0] || null;
  }


  async findAllByTenant(tenantId) {
    const query = `
            SELECT * FROM quotation_template_metadata 
            WHERE tenant_id = $1 AND is_deleted = false
        `;
    const rows = await AppDataSource.query(query, [tenantId]);
    return rows;
  }
}

module.exports = new QuotationTemplateRepository();
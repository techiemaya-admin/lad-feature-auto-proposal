// repositories/quotationEmail.repository.js
const db = require("../../../config/data-source");

class QuotationEmailRepository {
  async create(data) {
    console.log("create " + JSON.stringify(data))
    if (data.is_default) {
      await this.clearDefaults(data.tenant_id);
    }

    const query = `
      INSERT INTO quotation_email_template (
        name, tenant_id, subject, body_text, content_format, 
        body_html, description, media_url, media_alt_text, metadata, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      data.name, data.tenant_id, data.subject, data.body_text,
      data.content_format || 'plain_text', data.body_html,
      data.description, data.media_url, data.media_alt_text,
      data.metadata || {}, data.is_default
    ];
    const rows = await db.query(query, values);
    return rows;
  }

  async clearDefaults(tenant_id) {
    return await db.query(
      `UPDATE quotation_email_template SET is_default = false WHERE tenant_id = $1`,
      [tenant_id]
    );
  }


  async findAll(tenant_id) {
    const query = `
      SELECT * FROM quotation_email_template 
      WHERE tenant_id = $1 AND is_deleted = false
      ORDER BY created_at DESC;
    `;
    const rows = await db.query(query, [tenant_id]);
    return rows;
  }

  async findById(id, tenant_id) {
    const query = `
      SELECT * FROM quotation_email_template 
      WHERE id = $1 AND tenant_id = $2 AND is_deleted = false;
    `;
    const rows = await db.query(query, [id, tenant_id]);
    return rows;
  }

  async update(id, tenant_id, data) {
    console.log("create " + JSON.stringify(data))
    if (data.is_default) {
      await this.clearDefaults(data.tenant_id);

    }
    const query = `
      UPDATE quotation_email_template
      SET name = $1, subject = $2, body_text = $3, 
          body_html = $4, description = $5, updated_at = NOW(), is_default=$6
      WHERE id = $7 AND tenant_id = $8 AND is_deleted = false
      RETURNING *;
    `;
    const values = [data.name, data.subject, data.body_text, data.body_html, data.description, data.is_default, id, tenant_id];
    const rows = await db.query(query, values);
    return rows;
  }

  async softDelete(id, tenant_id) {
    const query = `
      UPDATE quotation_email_template 
      SET is_deleted = true, updated_at = NOW() 
      WHERE id = $1 AND tenant_id = $2;
    `;
    await db.query(query, [id, tenant_id]);
    return true;
  }
  // In your repository file
  async findDefaultByTenant(tenantId) {
    const query = `
    SELECT * FROM quotation_email_template 
    WHERE tenant_id = $1 
    AND is_default = true 
    AND is_deleted = false 
    LIMIT 1;
  `;
    const rows = await db.query(query, [tenantId]);
    return rows[0];

  }

  async setAsDefault(tenant_id, templateId) {
    await this.clearDefaults(tenant_id);
    const query = `UPDATE quotation_email_template SET is_default = true WHERE id = $1 AND tenant_id = $2 RETURNING *`;
    const rows = await db.query(query, [templateId, tenant_id]);
    if (rows.length > 0) {
      return rows[0];
    } else {
      // If no profile exists, return a default structure with null values
      return null;
    }

  }
}

module.exports = new QuotationEmailRepository();
const AppDataSource = require("../../../config/data-source");

class LeadAttachmentRepository {

  async create(data) {
    const sql = `
      INSERT INTO lead_attachments
      (
        tenant_id,
        lead_id,
        quotation_template_metadata_id,
        file_url,
        file_name,
        file_type,
        uploaded_by,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;

    const values = [
      data.tenant_id,
      data.lead_id,
      data.quotation_template_metadata_id || null,
      data.file_url,
      data.file_name,
      data.file_type,
      data.uploaded_by,
      JSON.stringify(data.metadata || {})
    ];

    const result = await AppDataSource.query(sql, values);
    return result[0];
  }

}

module.exports = new LeadAttachmentRepository();
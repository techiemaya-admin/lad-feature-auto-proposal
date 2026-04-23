const db = require('../../../config/data-source'); // Adjust path to your DB config

class EmailTemplateRepository {
    async findDefaultByTenant(tenantId) {
        const query = `
            SELECT * FROM email_templates 
            WHERE tenant_id = $1 AND is_default = true 
            LIMIT 1
        `;
        const rows  = await db.query(query, [tenantId]);
        return rows[0];
    }

    async findAllByTenant(tenantId) {
        const query = `
            SELECT * FROM email_templates 
            WHERE tenant_id = $1 AND is_deleted = false
        `;
        const rows = await db.query(query, [tenantId]);
        return rows;
    }

    async create(data) {
        const { tenant_id, template_name, subject_line, storage_path, relative_path, is_default, metadata } = data;

        // If this new template is default, unset others first
        if (is_default) {
            await this.clearDefaults(tenant_id);
        }

        const query = `
            INSERT INTO email_templates 
            (tenant_id, template_name, subject_line, storage_path, relative_path, is_default, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7 )
            RETURNING *;
        `;
        const rows = await db.query(query, [tenant_id, template_name, subject_line, storage_path, relative_path, is_default, metadata]);
        if (rows.length > 0) {
            return rows[0];
        } else {
            // If no profile exists, return a default structure with null values
            return null;
        }
    }

    async clearDefaults(tenant_id) {
        return await db.query(
            `UPDATE email_templates SET is_default = false WHERE tenant_id = $1`,
            [tenant_id]
        );
    }

    async setAsDefault(tenant_id, templateId) {
        await this.clearDefaults(tenant_id);
        const query = `UPDATE email_templates SET is_default = true WHERE id = $1 AND tenant_id = $2 RETURNING *`;
        const rows = await db.query(query, [templateId, tenant_id]);
        if (rows.length > 0) {
            return rows[0];
        } else {
            // If no profile exists, return a default structure with null values
            return null;
        }

    }

    async softDelete(templateId, tenant_id) {
        const query = `UPDATE email_templates SET is_deleted = true, is_default = false WHERE id = $1 AND tenant_id = $2 RETURNING *`;
        const rows = await db.query(query, [templateId, tenant_id]);
        if (rows.length > 0) {
            return rows[0];
        } else {
            // If no profile exists, return a default structure with null values
            return null;
        }

    }

    async findById(templateId) {
        const rows = await db.query(`SELECT * FROM email_templates WHERE id = $1 AND is_deleted = false`, [templateId]);
        if (rows.length > 0) {
            return rows[0];
        } else {
            // If no profile exists, return a default structure with null values
            return null;
        }

    }
}


module.exports = new EmailTemplateRepository();
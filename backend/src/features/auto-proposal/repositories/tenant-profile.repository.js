const db = require('../../../config/data-source'); // Adjust path to your DB config

class TenantProfileRepository {
    async findByTenantId(tenantId) {
        const query = `SELECT * FROM tenant_profile_details WHERE tenant_id = $1`;
        const rows = await db.query(query, [tenantId]);
        if (rows.length > 0) {
            return rows[0];
        } else {
            // If no profile exists, return a default structure with null values
            return null;
        }
    }

    async updateField(tenantId, fieldName, value) {
        // Validation: Ensure we only allow specific columns to be updated
        const allowedFields = [
            'company_logo_url', 'whatsapp_url', 'linkedin_url',
            'instagram_url', 'website_url', 'official_email','tagline','website_url'
        ];

        if (!allowedFields.includes(fieldName)) {
            throw new Error(`Invalid field name: ${fieldName}`);
        }

        const query = `
            INSERT INTO tenant_profile_details (tenant_id, ${fieldName}, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (tenant_id) 
            DO UPDATE SET ${fieldName} = EXCLUDED.${fieldName}, updated_at = NOW()
            RETURNING *;
        `;

        const rows = await db.query(query, [tenantId, value]);
       if (rows.length > 0) {
            return rows[0];
        } else {
            // If no profile exists, return a default structure with null values
            return null;
        }
    }
}

module.exports = new TenantProfileRepository();
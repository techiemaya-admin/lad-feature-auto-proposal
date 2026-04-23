const AppDataSource = require("../../../config/data-source");

class QuotationPlaceholderRepository {

    // In your quotation-placeholder.repository.js
    async findByTenant(tenantId) {
        const query = `
        SELECT placeholder_key, data_source_path 
        FROM quotation_placeholders 
        WHERE tenant_id = $1 AND is_deleted = false
    `;
        const result = await AppDataSource.query(query, [tenantId]);
        return result; // Returns an array of { placeholder_key, data_source_path }
    }
}

module.exports = new QuotationPlaceholderRepository();
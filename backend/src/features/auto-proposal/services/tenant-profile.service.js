const repository = require('../repositories/tenant-profile.repository');

class TenantProfileService {
    async getProfile(tenantId) {
        return await repository.findByTenantId(tenantId);
    }

    async updateProfileField(tenantId, fieldName, value) {
        // You could add logic here to validate URL formats if needed
        return await repository.updateField(tenantId, fieldName, value);
    }
}

module.exports = new TenantProfileService();
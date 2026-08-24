const AppDataSource = require('../../../../config/data-source');
const tenantRepository = require('../tenant.repository');

jest.mock('../../../../config/data-source', () => ({
  query: jest.fn(),
}));

describe('TenantRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('update', () => {
    it('returns null if updateData is null or undefined or empty', async () => {
      expect(await tenantRepository.update('tenant-1', null)).toBeNull();
      expect(await tenantRepository.update('tenant-1', undefined)).toBeNull();
      expect(await tenantRepository.update('tenant-1', {})).toBeNull();
      expect(AppDataSource.query).not.toHaveBeenCalled();
    });

    it('returns null if updateData contains only unapproved fields', async () => {
      const result = await tenantRepository.update('tenant-1', {
        unknown_column: 'value',
        "name = 'injected' --": 'exploit',
      });
      expect(result).toBeNull();
      expect(AppDataSource.query).not.toHaveBeenCalled();
    });

    it('filters out disallowed fields and updates only allowed fields with parameterized query', async () => {
      const mockUpdatedTenant = { id: 'tenant-1', name: 'New Tenant Name', slug: 'new-slug' };
      AppDataSource.query.mockResolvedValue([mockUpdatedTenant]);

      const result = await tenantRepository.update('tenant-1', {
        name: 'New Tenant Name',
        invalid_field: 'malicious',
        slug: 'new-slug',
      });

      expect(result).toEqual(mockUpdatedTenant);
      expect(AppDataSource.query).toHaveBeenCalledTimes(1);

      const [sql, values] = AppDataSource.query.mock.calls[0];
      expect(sql).toContain('UPDATE tenants');
      expect(sql).toContain('SET name = $2, slug = $3, updated_at = NOW()');
      expect(sql).toContain('WHERE id = $1');
      expect(values).toEqual(['tenant-1', 'New Tenant Name', 'new-slug']);
    });
  });
});

const AppDataSource = require('../../../../config/data-source');
const tenantRepository = require('../tenant.repository');

jest.mock('../../../../config/data-source', () => ({
  query: jest.fn(),
}));

describe('TenantRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('inserts tenant using valid init_db.sql schema and merges custom attributes into metadata JSONB', async () => {
      const mockCreatedTenant = {
        id: 'mock-uuid',
        name: 'Studio Acme',
        slug: 'studio-acme',
        status: 'trial',
        plan_tier: 'free',
        email: 'info@acme.com',
        phone: '+123456789',
        website: 'acme.com',
        metadata: { logo_url: 'https://cdn.example.com/logo.png', settings: { theme: 'dark' }, custom: 'val' }
      };
      AppDataSource.query.mockResolvedValue([mockCreatedTenant]);

      const result = await tenantRepository.create({
        name: 'Studio Acme',
        slug: 'studio-acme',
        email: 'info@acme.com',
        phone: '+123456789',
        website: 'acme.com',
        logo_url: 'https://cdn.example.com/logo.png',
        settings: { theme: 'dark' },
        metadata: { custom: 'val' }
      });

      expect(result).toEqual(mockCreatedTenant);
      expect(AppDataSource.query).toHaveBeenCalledTimes(1);

      const [sql, values] = AppDataSource.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO tenants (id, name, slug, status, plan_tier, email, phone, website, metadata, created_at, updated_at)');
      expect(values[1]).toBe('Studio Acme');
      expect(values[2]).toBe('studio-acme');
      expect(values[3]).toBe('trial');
      expect(values[4]).toBe('free');
      expect(values[5]).toBe('info@acme.com');
      expect(values[6]).toBe('+123456789');
      expect(values[7]).toBe('acme.com');
      expect(JSON.parse(values[8])).toEqual({
        custom: 'val',
        logo_url: 'https://cdn.example.com/logo.png',
        settings: { theme: 'dark' }
      });
    });
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

const leadReqConfigRepo = require('../lead_requirement_config.repository');
const db = require('../../../../config/data-source');

jest.mock('../../../../config/data-source', () => ({
  query: jest.fn(),
}));

describe('LeadRequirementConfigRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findIdByFieldKey', () => {
    it('uses field_key and id matching with tenant isolation in SQL query', async () => {
      db.query.mockResolvedValue([{ id: 'cfg-abc' }]);

      const result = await leadReqConfigRepo.findIdByFieldKey('tenant-123', 'guest_count');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/field_key\s*=\s*\$2\s*OR\s*id\s*=\s*\$2/i),
        ['tenant-123', 'guest_count']
      );
      expect(result).toBe('cfg-abc');
    });

    it('returns null if query throws error or returns empty', async () => {
      db.query.mockResolvedValue([]);
      const result = await leadReqConfigRepo.findIdByFieldKey('tenant-123', 'non_existent');
      expect(result).toBeNull();

      db.query.mockRejectedValue(new Error('DB error'));
      const errorResult = await leadReqConfigRepo.findIdByFieldKey('tenant-123', 'non_existent');
      expect(errorResult).toBeNull();
    });
  });

  describe('delete', () => {
    it('enforces tenant_id in SQL DELETE query', async () => {
      db.query.mockResolvedValue([{ id: 'cfg-abc', tenant_id: 'tenant-123' }]);

      const result = await leadReqConfigRepo.delete('cfg-abc', 'tenant-123');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE\s+FROM\s+lead_requirement_config\s+WHERE\s+id\s*=\s*\$1\s+AND\s+tenant_id\s*=\s*\$2/i),
        ['cfg-abc', 'tenant-123']
      );
      expect(result).toEqual({ id: 'cfg-abc', tenant_id: 'tenant-123' });
    });

    it('throws error when tenantId is missing', async () => {
      await expect(leadReqConfigRepo.delete('cfg-abc', null)).rejects.toThrow('Tenant ID is required');
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('updates is_active to false with tenant isolation', async () => {
      db.query.mockResolvedValue([]);

      await leadReqConfigRepo.deactivate('cfg-abc', 'tenant-123');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE\s+lead_requirement_config\s+SET\s+is_active\s*=\s*false\s+WHERE\s+id\s*=\s*\$1\s+AND\s+tenant_id\s*=\s*\$2/i),
        ['cfg-abc', 'tenant-123']
      );
    });

    it('throws error when tenantId is missing', async () => {
      await expect(leadReqConfigRepo.deactivate('cfg-abc', null)).rejects.toThrow('Tenant ID is required');
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('findByTenant', () => {
    it('queries configs filtering by tenant_id', async () => {
      const mockConfigs = [{ id: 'cfg-1', field_key: 'guest_count' }];
      db.query.mockResolvedValue(mockConfigs);

      const result = await leadReqConfigRepo.findByTenant('tenant-123');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT\s+\*\s+FROM\s+lead_requirement_config\s+WHERE\s+tenant_id\s*=\s*\$1/i),
        ['tenant-123']
      );
      expect(result).toEqual(mockConfigs);
    });
  });

  describe('getFieldKeysAsString', () => {
    it('aggregates active field keys into comma-separated string', async () => {
      db.query.mockResolvedValue([{ keys: 'guest_count, catering_tier, event_date' }]);

      const result = await leadReqConfigRepo.getFieldKeysAsString('tenant-123');

      expect(result).toBe('guest_count, catering_tier, event_date');
    });

    it('returns empty string when no keys found or query errors', async () => {
      db.query.mockResolvedValue([]);
      const resultEmpty = await leadReqConfigRepo.getFieldKeysAsString('tenant-123');
      expect(resultEmpty).toBe('');

      db.query.mockRejectedValue(new Error('DB failure'));
      const resultError = await leadReqConfigRepo.getFieldKeysAsString('tenant-123');
      expect(resultError).toBe('');
    });
  });
});

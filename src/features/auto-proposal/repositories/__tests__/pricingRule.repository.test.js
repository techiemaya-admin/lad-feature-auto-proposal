const db = require('../../../../config/data-source');
const pricingRuleRepository = require('../pricingRule.repository');

jest.mock('../../../../config/data-source', () => ({
  query: jest.fn(),
}));

describe('PricingRuleRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('delete', () => {
    it('executes parameterized DELETE query filtering by both id and tenant_id when tenantId is provided', async () => {
      db.query.mockResolvedValue([{ id: 'rule-1' }]);

      const result = await pricingRuleRepository.delete('rule-1', 'tenant-123');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM pricing_rules');
      expect(sql).toContain('WHERE id = $1 AND tenant_id = $2');
      expect(values).toEqual(['rule-1', 'tenant-123']);
      expect(result).toEqual({ id: 'rule-1' });
    });

    it('throws an error if tenantId is missing', async () => {
      await expect(pricingRuleRepository.delete('rule-1')).rejects.toThrow('Tenant ID is required');
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('executes parameterized SELECT query filtering by id, tenant_id, and is_deleted = false', async () => {
      db.query.mockResolvedValue([{ id: 'rule-1', tenant_id: 'tenant-123' }]);

      const result = await pricingRuleRepository.findById('rule-1', 'tenant-123');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('SELECT * FROM pricing_rules');
      expect(sql).toContain('WHERE id = $1 AND tenant_id = $2 AND is_deleted = false');
      expect(values).toEqual(['rule-1', 'tenant-123']);
      expect(result).toEqual({ id: 'rule-1', tenant_id: 'tenant-123' });
    });

    it('throws error when tenantId is missing', async () => {
      await expect(pricingRuleRepository.findById('rule-1')).rejects.toThrow('Tenant ID is required');
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('executes parameterized UPDATE query filtering by both id and tenant_id', async () => {
      db.query.mockResolvedValue([{ id: 'rule-1', name: 'Updated Rule', tenant_id: 'tenant-123' }]);

      const result = await pricingRuleRepository.update('rule-1', { name: 'Updated Rule' }, 'tenant-123');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('UPDATE pricing_rules');
      expect(sql).toContain('WHERE id = $15 AND tenant_id = $16');
      expect(values[14]).toBe('rule-1');
      expect(values[15]).toBe('tenant-123');
      expect(result).toEqual({ id: 'rule-1', name: 'Updated Rule', tenant_id: 'tenant-123' });
    });

    it('throws error when tenantId is missing', async () => {
      await expect(pricingRuleRepository.update('rule-1', { name: 'Updated' })).rejects.toThrow('Tenant ID is required');
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('executes parameterized UPDATE query filtering by both id and tenant_id', async () => {
      db.query.mockResolvedValue([{ id: 'rule-1' }]);

      const result = await pricingRuleRepository.softDelete('rule-1', 'tenant-123');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('UPDATE pricing_rules');
      expect(sql).toContain('SET is_deleted = true');
      expect(sql).toContain('WHERE id = $1 AND tenant_id = $2');
      expect(values).toEqual(['rule-1', 'tenant-123']);
      expect(result).toEqual({ id: 'rule-1' });
    });
  });
});

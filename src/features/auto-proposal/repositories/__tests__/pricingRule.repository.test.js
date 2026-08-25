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

    it('falls back to single id query if tenantId is not provided', async () => {
      db.query.mockResolvedValue([{ id: 'rule-1' }]);

      const result = await pricingRuleRepository.delete('rule-1');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM pricing_rules');
      expect(sql).toContain('WHERE id = $1');
      expect(values).toEqual(['rule-1']);
      expect(result).toEqual({ id: 'rule-1' });
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

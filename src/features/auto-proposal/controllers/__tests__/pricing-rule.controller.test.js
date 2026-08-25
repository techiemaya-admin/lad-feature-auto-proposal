const controller = require('../pricing-rule.controller');
const repo = require('../../repositories/pricingRule.repository');

jest.mock('../../repositories/pricingRule.repository');

describe('PricingRuleController', () => {
  let req;
  let res;

  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      tenantId: 'auth-tenant-123',
      body: {},
      params: {},
      query: {},
    };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('create', () => {
    it('populates tenant_id from req.tenantId when creating a rule', async () => {
      req.body = { name: 'Rule 1', target_type: 'package' };
      repo.create.mockResolvedValue({ id: 'pr-1', tenant_id: 'auth-tenant-123', ...req.body });

      await controller.create(req, res, next);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: 'auth-tenant-123', name: 'Rule 1' })
      );
      expect(res.json).toHaveBeenCalled();
    });

    it('forwards error to next on failure', async () => {
      const error = new Error('Database create failed');
      repo.create.mockRejectedValue(error);

      await controller.create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getAll', () => {
    it('uses req.tenantId to find pricing rules', async () => {
      req.params = { tenant_id: 'spoofed-tenant-456' };
      repo.findAll.mockResolvedValue([{ id: 'pr-1' }]);

      await controller.getAll(req, res, next);

      expect(repo.findAll).toHaveBeenCalledWith('auth-tenant-123');
      expect(res.json).toHaveBeenCalledWith([{ id: 'pr-1' }]);
    });
  });

  describe('delete', () => {
    it('passes req.params.id and req.tenantId to repo.delete to enforce tenant isolation', async () => {
      req.params = { id: 'pr-1' };
      repo.delete.mockResolvedValue({ id: 'pr-1' });

      await controller.delete(req, res, next);

      expect(repo.delete).toHaveBeenCalledWith('pr-1', 'auth-tenant-123');
      expect(res.json).toHaveBeenCalledWith({ message: 'Deleted successfully' });
    });

    it('forwards error to next on failure', async () => {
      const error = new Error('Database delete failed');
      repo.delete.mockRejectedValue(error);
      req.params = { id: 'pr-1' };

      await controller.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

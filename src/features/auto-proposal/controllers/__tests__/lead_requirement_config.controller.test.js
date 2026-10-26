const controller = require('../lead_requirement_config.controller');
const repo = require('../../repositories/lead_requirement_config.repository');

jest.mock('../../repositories/lead_requirement_config.repository');

describe('LeadRequirementConfigController', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      tenantId: 'tenant-123',
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
    it('populates tenant_id from req.tenantId and calls repo.create', async () => {
      req.body = { field_key: 'theme', label: 'Event Theme' };
      repo.create.mockResolvedValue({ id: 'cfg-1', ...req.body, tenant_id: 'tenant-123' });

      await controller.create(req, res, next);

      expect(repo.create).toHaveBeenCalledWith({
        field_key: 'theme',
        label: 'Event Theme',
        tenant_id: 'tenant-123',
      });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'cfg-1' }));
    });

    it('forwards error to next on failure', async () => {
      const error = new Error('Create error');
      repo.create.mockRejectedValue(error);

      await controller.create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('get', () => {
    it('retrieves configs for tenant', async () => {
      repo.findByTenant.mockResolvedValue([{ id: 'cfg-1' }]);

      await controller.get(req, res, next);

      expect(repo.findByTenant).toHaveBeenCalledWith('tenant-123');
      expect(res.json).toHaveBeenCalledWith([{ id: 'cfg-1' }]);
    });
  });

  describe('update', () => {
    it('updates config using req.params.id and req.tenantId', async () => {
      req.params = { id: 'cfg-1' };
      req.body = { label: 'Updated Label' };
      repo.update.mockResolvedValue({ id: 'cfg-1', label: 'Updated Label' });

      await controller.update(req, res, next);

      expect(repo.update).toHaveBeenCalledWith('cfg-1', {
        label: 'Updated Label',
        tenant_id: 'tenant-123',
      });
      expect(res.json).toHaveBeenCalledWith({ id: 'cfg-1', label: 'Updated Label' });
    });
  });

  describe('delete', () => {
    it('passes tenantId to repo.delete and returns success message', async () => {
      req.params = { id: 'cfg-abc' };
      req.tenantId = 'tenant-123';
      repo.delete.mockResolvedValue({ id: 'cfg-abc' });

      await controller.delete(req, res, next);

      expect(repo.delete).toHaveBeenCalledWith('cfg-abc', 'tenant-123');
      expect(res.json).toHaveBeenCalledWith({ message: 'Field disabled' });
    });

    it('forwards error to next on failure', async () => {
      req.params = { id: 'cfg-abc' };
      const error = new Error('Delete error');
      repo.delete.mockRejectedValue(error);

      await controller.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

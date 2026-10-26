const controller = require('../lead_requirement_values.controller');
const leadRequirementValuesRepo = require('../../repositories/lead_requirement_values.repository');

jest.mock('../../repositories/lead_requirement_values.repository');

describe('LeadRequirementValuesController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      tenantId: 'tenant-123',
      params: {},
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('create', () => {
    beforeEach(() => {
      leadRequirementValuesRepo.belongsToTenant.mockResolvedValue(true);
    });

    it('returns 404 and writes nothing when the lead requirement belongs to another tenant', async () => {
      req.body = { lead_requirement_id: 'other-tenant-req', field_id: 'field-1', value_number: 1 };
      leadRequirementValuesRepo.belongsToTenant.mockResolvedValue(false);

      await controller.create(req, res, next);

      expect(leadRequirementValuesRepo.belongsToTenant).toHaveBeenCalledWith('other-tenant-req', 'tenant-123', 'field-1');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(leadRequirementValuesRepo.create).not.toHaveBeenCalled();
      expect(leadRequirementValuesRepo.saveRequirementValues).not.toHaveBeenCalled();
    });

    it('saves dynamic requirements batch when provided', async () => {
      req.body = {
        lead_requirement_id: 'req-1',
        dynamic_requirements: { catering_count: 50 }
      };
      leadRequirementValuesRepo.saveRequirementValues.mockResolvedValue([{ id: 'val-1' }]);

      await controller.create(req, res, next);

      expect(leadRequirementValuesRepo.saveRequirementValues).toHaveBeenCalledWith('tenant-123', 'req-1', { catering_count: 50 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Saved', data: [{ id: 'val-1' }] });
    });

    it('creates single value entry when dynamic_requirements is not provided', async () => {
      req.body = {
        lead_requirement_id: 'req-1',
        field_id: 'field-1',
        value_number: 100
      };
      const createdRecord = { id: 'val-1', lead_requirement_id: 'req-1', field_id: 'field-1', value_number: 100 };
      leadRequirementValuesRepo.create.mockResolvedValue(createdRecord);

      await controller.create(req, res, next);

      expect(leadRequirementValuesRepo.create).toHaveBeenCalledWith({
        lead_requirement_id: 'req-1',
        field_id: 'field-1',
        value_text: undefined,
        value_number: 100,
        value_json: undefined
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdRecord);
    });

    it('forwards error to next middleware on failure', async () => {
      const error = new Error('Database failed');
      leadRequirementValuesRepo.create.mockRejectedValue(error);

      await controller.create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('get / update / delete are tenant-scoped', () => {
    it('passes req.tenantId to every lookup', async () => {
      req.params = { id: 'x-1' };
      leadRequirementValuesRepo.findByRequirementId.mockResolvedValue([]);
      leadRequirementValuesRepo.update.mockResolvedValue({ id: 'x-1' });
      leadRequirementValuesRepo.delete.mockResolvedValue({ id: 'x-1' });

      await controller.get(req, res, next);
      await controller.update(req, res, next);
      await controller.delete(req, res, next);

      expect(leadRequirementValuesRepo.findByRequirementId).toHaveBeenCalledWith('x-1', 'tenant-123');
      expect(leadRequirementValuesRepo.update).toHaveBeenCalledWith('x-1', {}, 'tenant-123');
      expect(leadRequirementValuesRepo.delete).toHaveBeenCalledWith('x-1', 'tenant-123');
    });

    it('returns 404 when another tenant\'s value is updated or deleted', async () => {
      req.params = { id: 'other-tenant-value' };
      leadRequirementValuesRepo.update.mockResolvedValue(undefined);
      leadRequirementValuesRepo.delete.mockResolvedValue(undefined);

      await controller.update(req, res, next);
      await controller.delete(req, res, next);

      expect(res.status).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenNthCalledWith(1, 404);
      expect(res.status).toHaveBeenNthCalledWith(2, 404);
    });
  });
});

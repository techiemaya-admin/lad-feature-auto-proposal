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

  describe('get', () => {
    it('retrieves values for requirement id', async () => {
      req.params.id = 'req-1';
      leadRequirementValuesRepo.findByRequirementId.mockResolvedValue([{ id: 'val-1', value_number: 10 }]);

      await controller.get(req, res, next);

      expect(leadRequirementValuesRepo.findByRequirementId).toHaveBeenCalledWith('req-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: 'val-1', value_number: 10 }]);
    });
  });

  describe('update', () => {
    it('updates a value record by id', async () => {
      req.params.id = 'val-1';
      req.body = { value_number: 200 };
      leadRequirementValuesRepo.update.mockResolvedValue({ id: 'val-1', value_number: 200 });

      await controller.update(req, res, next);

      expect(leadRequirementValuesRepo.update).toHaveBeenCalledWith('val-1', { value_number: 200 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: 'val-1', value_number: 200 });
    });
  });

  describe('delete', () => {
    it('deletes a value record by id', async () => {
      req.params.id = 'val-1';
      leadRequirementValuesRepo.delete.mockResolvedValue({ id: 'val-1' });

      await controller.delete(req, res, next);

      expect(leadRequirementValuesRepo.delete).toHaveBeenCalledWith('val-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Deleted', data: { id: 'val-1' } });
    });
  });
});

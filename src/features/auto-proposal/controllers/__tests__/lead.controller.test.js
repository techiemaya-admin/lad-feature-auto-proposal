const leadController = require('../lead.controller');
const leadService = require('../../services/lead.service');

jest.mock('../../services/lead.service');

describe('LeadController', () => {
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
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('list', () => {
    it('uses default limit=100 and offset=0 when query parameters are omitted', async () => {
      req.query = {};
      leadService.listLeads.mockResolvedValue([]);

      await leadController.list(req, res, next);

      expect(leadService.listLeads).toHaveBeenCalledWith('tenant-123', 100, 0);
    });

    it('uses default limit=100 and offset=0 when query parameters are invalid strings', async () => {
      req.query = { limit: 'invalid', offset: 'not-a-number' };
      leadService.listLeads.mockResolvedValue([]);

      await leadController.list(req, res, next);

      expect(leadService.listLeads).toHaveBeenCalledWith('tenant-123', 100, 0);
    });

    it('clamps negative limit and offset to zero', async () => {
      req.query = { limit: '-15', offset: '-5' };
      leadService.listLeads.mockResolvedValue([]);

      await leadController.list(req, res, next);

      expect(leadService.listLeads).toHaveBeenCalledWith('tenant-123', 0, 0);
    });

    it('preserves valid limit and offset within bounds', async () => {
      req.query = { limit: '25', offset: '50' };
      leadService.listLeads.mockResolvedValue([]);

      await leadController.list(req, res, next);

      expect(leadService.listLeads).toHaveBeenCalledWith('tenant-123', 25, 50);
    });

    it('caps limit at 100 when requested limit exceeds 100', async () => {
      req.query = { limit: '250', offset: '10' };
      leadService.listLeads.mockResolvedValue([]);

      await leadController.list(req, res, next);

      expect(leadService.listLeads).toHaveBeenCalledWith('tenant-123', 100, 10);
    });

    it('preserves limit=0 when 0 is explicitly passed', async () => {
      req.query = { limit: '0', offset: '0' };
      leadService.listLeads.mockResolvedValue([]);

      await leadController.list(req, res, next);

      expect(leadService.listLeads).toHaveBeenCalledWith('tenant-123', 0, 0);
    });

    it('forwards errors to next handler', async () => {
      const error = new Error('Service error');
      leadService.listLeads.mockRejectedValue(error);

      await leadController.list(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

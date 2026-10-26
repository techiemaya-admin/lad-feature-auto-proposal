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
      userId: 'user-456',
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

  describe('create', () => {
    it('creates lead with DTO and returns 201 with serialized response', async () => {
      req.body = {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane.doe@example.com',
        phone: '+1234567890',
        company_name: 'Acme Inc',
      };

      const mockCreatedLead = {
        id: 'lead-999',
        tenant_id: 'tenant-123',
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane.doe@example.com',
        phone: '+1234567890',
        company_name: 'Acme Inc',
        status: 'active',
        stage: 'new',
        priority: 0,
        tags: [],
        custom_fields: {},
        created_at: '2026-08-25T10:00:00.000Z',
        updated_at: '2026-08-25T10:00:00.000Z',
      };

      leadService.createLead.mockResolvedValue(mockCreatedLead);

      await leadController.create(req, res, next);

      expect(leadService.createLead).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane.doe@example.com',
          phone: '+1234567890',
          company_name: 'Acme Inc',
        }),
        'user-456'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 'lead-999',
        tenant_id: 'tenant-123',
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane.doe@example.com',
        phone: '+1234567890',
        company_name: 'Acme Inc',
      }));
    });

    it('forwards creation errors to next', async () => {
      const error = new Error('Either Email or Phone is required to create a lead.');
      error.statusCode = 400;
      leadService.createLead.mockRejectedValue(error);

      await leadController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getById', () => {
    it('passes parameters in correct order (req.params.id, req.tenantId) to leadService.getLeadById', async () => {
      req.params = { id: 'lead-uuid-123' };
      req.tenantId = 'tenant-uuid-456';

      const mockLead = {
        id: 'lead-uuid-123',
        tenant_id: 'tenant-uuid-456',
        first_name: 'Alice',
        last_name: 'Smith',
        email: 'alice@example.com',
        phone: '+1987654321',
        company_name: 'Beta LLC',
        status: 'active',
        stage: 'proposal',
        priority: 1,
        tags: ['vip'],
        custom_fields: { budget: 20000 },
        created_at: '2026-08-25T08:00:00.000Z',
        updated_at: '2026-08-25T09:00:00.000Z',
      };

      leadService.getLeadById.mockResolvedValue(mockLead);

      await leadController.getById(req, res, next);

      // Verify parameter order: ID first, TenantId second
      expect(leadService.getLeadById).toHaveBeenCalledWith('lead-uuid-123', 'tenant-uuid-456');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 'lead-uuid-123',
        tenant_id: 'tenant-uuid-456',
        first_name: 'Alice',
        last_name: 'Smith',
        email: 'alice@example.com',
        phone: '+1987654321',
        company_name: 'Beta LLC',
        status: 'active',
        tags: ['vip'],
        custom_fields: { budget: 20000 },
      }));
    });

    it('forwards 404 not found error to next handler', async () => {
      req.params = { id: 'non-existent-id' };
      req.tenantId = 'tenant-uuid-456';

      const notFoundError = new Error('Lead not found');
      notFoundError.statusCode = 404;
      leadService.getLeadById.mockRejectedValue(notFoundError);

      await leadController.getById(req, res, next);

      expect(leadService.getLeadById).toHaveBeenCalledWith('non-existent-id', 'tenant-uuid-456');
      expect(next).toHaveBeenCalledWith(notFoundError);
    });
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

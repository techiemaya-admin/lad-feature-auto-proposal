const leadService = require('../lead.service');
const leadRepository = require('../../repositories/lead.repository');

jest.mock('../../repositories/lead.repository');

describe('LeadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLead', () => {
    it('throws 400 error when tenantId is missing', async () => {
      await expect(leadService.createLead(null, { email: 'test@example.com' })).rejects.toMatchObject({
        message: 'Tenant ID is required',
        statusCode: 400,
      });
    });

    it('throws 400 error when neither email nor phone is provided', async () => {
      await expect(leadService.createLead('tenant-123', { first_name: 'John' })).rejects.toMatchObject({
        message: 'Either Email or Phone is required to create a lead.',
        statusCode: 400,
      });
    });

    it('successfully creates a lead when email is provided', async () => {
      const mockCreatedLead = {
        id: 'lead-1',
        tenant_id: 'tenant-123',
        email: 'john@example.com',
        status: 'active',
        stage: 'new',
        priority: 0,
        tags: [],
        custom_fields: {},
        raw_data: {},
      };
      leadRepository.create.mockResolvedValue(mockCreatedLead);

      const result = await leadService.createLead('tenant-123', {
        email: 'john@example.com',
        first_name: 'John',
      }, 'user-abc');

      expect(leadRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 'tenant-123',
        email: 'john@example.com',
        first_name: 'John',
        created_by_user_id: 'user-abc',
        status: 'active',
        stage: 'new',
        priority: 0,
        tags: [],
        custom_fields: {},
      }));
      expect(result).toEqual(mockCreatedLead);
    });

    it('successfully creates a lead when phone is provided without email', async () => {
      const mockCreatedLead = {
        id: 'lead-2',
        tenant_id: 'tenant-123',
        phone: '+1234567890',
      };
      leadRepository.create.mockResolvedValue(mockCreatedLead);

      const result = await leadService.createLead('tenant-123', {
        phone: '+1234567890',
        tags: ['inbound'],
        custom_fields: { source: 'call' },
      });

      expect(leadRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 'tenant-123',
        phone: '+1234567890',
        tags: ['inbound'],
        custom_fields: { source: 'call' },
      }));
      expect(result).toEqual(mockCreatedLead);
    });
  });

  describe('getLeadById', () => {
    it('throws 400 error when id or tenantId is missing', async () => {
      await expect(leadService.getLeadById(null, 'tenant-123')).rejects.toMatchObject({
        message: 'Lead ID and Tenant ID are required',
        statusCode: 400,
      });
      await expect(leadService.getLeadById('lead-1', null)).rejects.toMatchObject({
        message: 'Lead ID and Tenant ID are required',
        statusCode: 400,
      });
    });

    it('returns the lead when found for the authenticated tenant', async () => {
      const mockLead = { id: 'lead-1', tenant_id: 'tenant-123', email: 'john@example.com' };
      leadRepository.findById.mockResolvedValue(mockLead);

      const result = await leadService.getLeadById('lead-1', 'tenant-123');

      expect(leadRepository.findById).toHaveBeenCalledWith('lead-1', 'tenant-123');
      expect(result).toEqual(mockLead);
    });

    it('throws 404 error when lead is not found or belongs to another tenant', async () => {
      leadRepository.findById.mockResolvedValue(undefined);

      await expect(leadService.getLeadById('non-existent-lead', 'tenant-123')).rejects.toMatchObject({
        message: 'Lead not found',
        statusCode: 404,
      });
      expect(leadRepository.findById).toHaveBeenCalledWith('non-existent-lead', 'tenant-123');
    });
  });

  describe('listLeads', () => {
    it('throws error when tenantId is missing', async () => {
      await expect(leadService.listLeads(null)).rejects.toThrow('Tenant ID is required');
      await expect(leadService.listLeads('')).rejects.toThrow('Tenant ID is required');
      await expect(leadService.listLeads(undefined)).rejects.toThrow('Tenant ID is required');
    });

    it('passes default limit=100 and offset=0 when limit and offset are omitted', async () => {
      const mockLeads = [{ id: 'lead-1' }, { id: 'lead-2' }];
      leadRepository.findByTenant.mockResolvedValue(mockLeads);

      const result = await leadService.listLeads('tenant-123');

      expect(leadRepository.findByTenant).toHaveBeenCalledWith('tenant-123', 100, 0);
      expect(result).toEqual(mockLeads);
    });

    it('passes custom limit and offset to leadRepository.findByTenant', async () => {
      const mockLeads = [{ id: 'lead-1' }];
      leadRepository.findByTenant.mockResolvedValue(mockLeads);

      const result = await leadService.listLeads('tenant-123', 25, 50);

      expect(leadRepository.findByTenant).toHaveBeenCalledWith('tenant-123', 25, 50);
      expect(result).toEqual(mockLeads);
    });

    it('preserves limit=0 without replacing it with default limit', async () => {
      const mockLeads = [];
      leadRepository.findByTenant.mockResolvedValue(mockLeads);

      const result = await leadService.listLeads('tenant-123', 0, 0);

      expect(leadRepository.findByTenant).toHaveBeenCalledWith('tenant-123', 0, 0);
      expect(result).toEqual(mockLeads);
    });
  });

  describe('updateLead', () => {
    it('updates existing lead merged with new attributes', async () => {
      const existingLead = {
        id: 'lead-1',
        tenant_id: 'tenant-123',
        first_name: 'John',
        tags: ['old'],
        custom_fields: { a: 1 },
      };
      const updatedLead = { ...existingLead, first_name: 'Johnny', custom_fields: { a: 1, b: 2 } };

      leadRepository.findById.mockResolvedValue(existingLead);
      leadRepository.update.mockResolvedValue(updatedLead);

      const result = await leadService.updateLead('lead-1', 'tenant-123', {
        first_name: 'Johnny',
        custom_fields: { b: 2 },
      });

      expect(leadRepository.update).toHaveBeenCalledWith('lead-1', 'tenant-123', expect.objectContaining({
        first_name: 'Johnny',
        custom_fields: { a: 1, b: 2 },
      }));
      expect(result).toEqual(updatedLead);
    });
  });

  describe('deleteLead', () => {
    it('soft deletes lead when found', async () => {
      const deletedLead = { id: 'lead-1', is_deleted: true };
      leadRepository.softDelete.mockResolvedValue(deletedLead);

      const result = await leadService.deleteLead('lead-1', 'tenant-123');

      expect(leadRepository.softDelete).toHaveBeenCalledWith('lead-1', 'tenant-123');
      expect(result).toEqual(deletedLead);
    });

    it('throws 404 when lead is not found or already deleted', async () => {
      leadRepository.softDelete.mockResolvedValue(undefined);

      await expect(leadService.deleteLead('lead-1', 'tenant-123')).rejects.toMatchObject({
        message: 'Lead not found or already deleted',
        statusCode: 404,
      });
    });
  });

  describe('getLeadByRequirement', () => {
    it('returns lead associated with requirement ID', async () => {
      const mockLead = { id: 'lead-1', tenant_id: 'tenant-123' };
      leadRepository.findByLeadRequirementId.mockResolvedValue(mockLead);

      const result = await leadService.getLeadByRequirement('req-1', 'tenant-123');

      expect(leadRepository.findByLeadRequirementId).toHaveBeenCalledWith('req-1', 'tenant-123');
      expect(result).toEqual(mockLead);
    });

    it('throws 404 when no lead is associated with requirement', async () => {
      leadRepository.findByLeadRequirementId.mockResolvedValue(undefined);

      await expect(leadService.getLeadByRequirement('req-1', 'tenant-123')).rejects.toMatchObject({
        message: 'No lead associated with this requirement',
        statusCode: 404,
      });
    });
  });
});

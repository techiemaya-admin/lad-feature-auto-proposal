const leadService = require('../lead.service');
const leadRepository = require('../../repositories/lead.repository');

jest.mock('../../repositories/lead.repository');

describe('LeadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});

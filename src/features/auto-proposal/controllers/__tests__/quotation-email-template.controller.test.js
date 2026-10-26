const quotationEmailTemplateController = require('../quotation-email-template.controller');
const service = require('../../services/quotation-email-template.service');
const leadService = require('../../services/lead.service');
const tenantService = require('../../services/tenant.service');
const tenantProfileRepository = require('../../repositories/tenant-profile.repository');

jest.mock('../../services/quotation-email-template.service');
jest.mock('../../services/lead.service');
jest.mock('../../services/tenant.service');
jest.mock('../../repositories/tenant-profile.repository');

describe('QuotationEmailTemplateController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      tenantId: 'tenant-123',
      params: { contact_id: 'lead-456' },
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('listViaAuth', () => {
    it('successfully delegates profile query to tenantProfileRepository.findByTenantId and populates placeholders', async () => {
      const mockTemplates = [
        {
          id: 'tmpl-1',
          name: 'Welcome Quote',
          subject: 'Quote for [lead_name] from [company_name]',
          body_text: 'Dear [lead_name], your contact email is [company_email]. Follow us on Instagram: [instagram_url]',
          body_html: '',
          is_deleted: false,
          created_at: new Date('2026-08-25T10:00:00Z'),
        },
      ];

      service.getAllTemplates.mockResolvedValue(mockTemplates);
      leadService.getLeadById.mockResolvedValue({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      });
      tenantService.getTenantById.mockResolvedValue({
        name: 'Acme Corp',
        phone: '+1-555-0100',
        website: 'acme.example.com',
      });
      tenantProfileRepository.findByTenantId.mockResolvedValue({
        official_email: 'sales@acme.example.com',
        company_logo_url: 'https://cdn.example.com/logo.png',
        tagline: 'Building the Future',
        instagram_url: 'https://instagram.com/acme',
        linkedin_url: 'https://linkedin.com/company/acme',
        whatsapp_url: 'https://wa.me/15550100',
      });

      await quotationEmailTemplateController.listViaAuth(req, res);

      expect(tenantProfileRepository.findByTenantId).toHaveBeenCalledWith('tenant-123');
      expect(res.status).toHaveBeenCalledWith(200);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data).toHaveLength(1);
      expect(responseBody.data[0].subject).toBe('Quote for John Doe from Acme Corp');
      expect(responseBody.data[0].body).toContain('Dear John Doe, your contact email is sales@acme.example.com.');
      expect(responseBody.data[0].body).toContain('Follow us on Instagram: https://instagram.com/acme');
    });

    it('handles empty/missing tenant profile gracefully', async () => {
      service.getAllTemplates.mockResolvedValue([
        {
          id: 'tmpl-2',
          name: 'Minimal Template',
          subject: 'Hello [company_name]',
          body_text: 'Email: [company_email]',
          body_html: '<p>Email: [company_email]</p>',
          is_deleted: false,
          created_at: new Date('2026-08-25T10:00:00Z'),
        },
      ]);
      leadService.getLeadById.mockResolvedValue(null);
      tenantService.getTenantById.mockResolvedValue({ name: 'Solo Tenant' });
      tenantProfileRepository.findByTenantId.mockResolvedValue(null);

      await quotationEmailTemplateController.listViaAuth(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data[0].subject).toBe('Hello Solo Tenant');
      expect(responseBody.data[0].body).toBe('Email: ');
    });

    it('returns 500 when fetching templates throws an error', async () => {
      service.getAllTemplates.mockRejectedValue(new Error('DB failure'));

      await quotationEmailTemplateController.listViaAuth(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB failure' });
    });
  });

  describe('remove', () => {
    it('resolves req.params.tenantId fallback and calls deleteTemplate', async () => {
      delete req.tenantId; // simulate no req.tenantId on request object
      req.params = { id: 'tpl-123', tenantId: 'tenant-789' };
      service.deleteTemplate.mockResolvedValue(true);

      await quotationEmailTemplateController.remove(req, res);

      expect(service.deleteTemplate).toHaveBeenCalledWith('tpl-123', 'tenant-789');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });
});


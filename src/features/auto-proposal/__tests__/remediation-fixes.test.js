const leadReqConfigRepo = require('../repositories/lead_requirement_config.repository');
const leadReqConfigController = require('../controllers/lead_requirement_config.controller');
const quotationEmailController = require('../controllers/quotation-email-template.controller');
const quotationEmailService = require('../services/quotation-email-template.service');
const conceptRepo = require('../repositories/concept.repository');
const pricingRuleController = require('../controllers/pricing-rule.controller');
const pricingRuleRepo = require('../repositories/pricingRule.repository');
const tenantProfileController = require('../controllers/tenant-profile.controller');
const tenantProfileRepo = require('../repositories/tenant-profile.repository');
const db = require('../../../config/data-source');

jest.mock('../../../config/data-source');
jest.mock('../services/quotation-email-template.service');
jest.mock('../repositories/pricingRule.repository');
jest.mock('../repositories/tenant-profile.repository');

describe('Remediation Fixes Suite', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      tenantId: 'tenant-123',
      body: {},
      params: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('1. Dynamic Pricing & Lead Requirement Config Repository', () => {
    it('findIdByFieldKey uses field_key matching in SQL query', async () => {
      db.query.mockResolvedValue([{ id: 'cfg-abc' }]);

      const result = await leadReqConfigRepo.findIdByFieldKey('tenant-123', 'guest_count');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/field_key\s*=\s*\$2\s*OR\s*id\s*=\s*\$2/i),
        ['tenant-123', 'guest_count']
      );
      expect(result).toBe('cfg-abc');
    });

    it('delete method enforces tenant_id in SQL query', async () => {
      db.query.mockResolvedValue([{ id: 'cfg-abc', tenant_id: 'tenant-123' }]);

      const result = await leadReqConfigRepo.delete('cfg-abc', 'tenant-123');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE\s+FROM\s+lead_requirement_config\s+WHERE\s+id\s*=\s*\$1\s+AND\s+tenant_id\s*=\s*\$2/i),
        ['cfg-abc', 'tenant-123']
      );
      expect(result).toEqual({ id: 'cfg-abc', tenant_id: 'tenant-123' });
    });

    it('lead_requirement_config controller delete passes tenantId to repo', async () => {
      req.params = { id: 'cfg-abc' };
      req.tenantId = 'tenant-123';
      const repoDeleteSpy = jest.spyOn(leadReqConfigRepo, 'delete').mockResolvedValue({ id: 'cfg-abc' });

      await leadReqConfigController.delete(req, res, next);

      expect(repoDeleteSpy).toHaveBeenCalledWith('cfg-abc', 'tenant-123');
      expect(res.json).toHaveBeenCalledWith({ message: 'Field disabled' });
    });
  });

  describe('2. Quotation Email Template Controller Route Param Mismatch', () => {
    it('remove controller resolves req.params.tenantId and calls deleteTemplate', async () => {
      delete req.tenantId; // simulate no req.tenantId
      req.params = { id: 'tpl-123', tenantId: 'tenant-789' };
      quotationEmailService.deleteTemplate.mockResolvedValue(true);

      await quotationEmailController.remove(req, res);

      expect(quotationEmailService.deleteTemplate).toHaveBeenCalledWith('tpl-123', 'tenant-789');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('3. Concept Repository findByIds Implementation', () => {
    it('conceptRepo.findByIds queries database with ANY filter and tenant isolation', async () => {
      db.query.mockResolvedValue([
        { id: 'c-1', name: 'Concept 1', requirement_configs: [] },
        { id: 'c-2', name: 'Concept 2', requirement_configs: [] }
      ]);

      const result = await conceptRepo.findByIds('tenant-123', ['c-1', 'c-2']);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/WHERE\s+c\.tenant_id\s*=\s*\$1\s+AND\s+c\.id\s*=\s*ANY\(\$2\)/i),
        ['tenant-123', ['c-1', 'c-2']]
      );
      expect(result).toHaveLength(2);
    });

    it('conceptRepo.findByIds returns empty array when empty array is passed', async () => {
      const result = await conceptRepo.findByIds('tenant-123', []);
      expect(result).toEqual([]);
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('4. Pricing Rule Controller Soft Deletion', () => {
    it('delete invokes repo.softDelete with id and tenantId', async () => {
      req.params = { id: 'rule-999' };
      req.tenantId = 'tenant-123';
      pricingRuleRepo.softDelete.mockResolvedValue({ id: 'rule-999' });

      await pricingRuleController.delete(req, res, next);

      expect(pricingRuleRepo.softDelete).toHaveBeenCalledWith('rule-999', 'tenant-123');
      expect(res.json).toHaveBeenCalledWith({ message: 'Deleted successfully' });
    });
  });

  describe('5. Tenant Profile Controller Compatibility', () => {
    it('accepts fieldName and fieldValue schema format', async () => {
      req.params = { tenantId: 'tenant-123' };
      req.body = { fieldName: 'tagline', fieldValue: 'Premium Events' };
      tenantProfileRepo.updateField.mockResolvedValue({ tagline: 'Premium Events' });

      await tenantProfileController.updateField(req, res);

      expect(tenantProfileRepo.updateField).toHaveBeenCalledWith('tenant-123', 'tagline', 'Premium Events');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'tagline updated successfully',
        data: { tagline: 'Premium Events' }
      }));
    });

    it('accepts standard field and value schema format', async () => {
      req.params = { tenantId: 'tenant-123' };
      req.body = { field: 'website', value: 'https://example.com' };
      tenantProfileRepo.updateField.mockResolvedValue({ website: 'https://example.com' });

      await tenantProfileController.updateField(req, res);

      expect(tenantProfileRepo.updateField).toHaveBeenCalledWith('tenant-123', 'website', 'https://example.com');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});

jest.mock('../../services/ai-response.service', () => ({
  isConfigured: true,
  suggestConcepts: jest.fn(),
  suggestPricingRules: jest.fn(),
  suggestEmailTemplates: jest.fn(),
  suggestEmailTemplete: jest.fn()
}));

const service = require('../../services/ai-response.service');
const controller = require('../ai.response.controller');

describe('AiResponseController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    service.isConfigured = true;

    req = {
      params: {
        tenantId: 'tenant-123'
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('Unconfigured AI Service (503)', () => {
    it('returns 503 when service.isConfigured is false for suggestConcepts', async () => {
      service.isConfigured = false;

      await controller.suggestConcepts(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AI service is not configured with valid API keys'
      });
      expect(service.suggestConcepts).not.toHaveBeenCalled();
    });

    it('returns 503 when service.isConfigured is false for suggestPricingRules', async () => {
      service.isConfigured = false;

      await controller.suggestPricingRules(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AI service is not configured with valid API keys'
      });
      expect(service.suggestPricingRules).not.toHaveBeenCalled();
    });

    it('returns 503 when service.isConfigured is false for suggestEmailTemplates', async () => {
      service.isConfigured = false;

      await controller.suggestEmailTemplates(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AI service is not configured with valid API keys'
      });
      expect(service.suggestEmailTemplates).not.toHaveBeenCalled();
    });

    it('returns 503 when service throws 503 unconfigured error', async () => {
      service.isConfigured = true;
      const error = new Error('AI service is not configured with valid API keys');
      error.statusCode = 503;
      service.suggestConcepts.mockRejectedValue(error);

      await controller.suggestConcepts(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AI service is not configured with valid API keys'
      });
    });
  });

  describe('Successful Suggestions (200)', () => {
    it('returns 200 with concept suggestions', async () => {
      const mockConcepts = {
        suggestions: [
          {
            name: 'Standard Package',
            description: 'Standard event services',
            estimated_base_price: 2000,
            suggested_deliverables: ['Event Coordinator']
          }
        ]
      };
      service.suggestConcepts.mockResolvedValue(mockConcepts);

      await controller.suggestConcepts(req, res);

      expect(service.suggestConcepts).toHaveBeenCalledWith('tenant-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockConcepts);
    });

    it('returns 200 with pricing rules suggestions', async () => {
      const mockRules = {
        suggestions: [
          {
            name: 'Early Bird',
            condition_field: 'days_in_advance',
            condition_operator: '>=',
            condition_value: 30,
            action_type: 'discount',
            action_mode: 'percentage',
            action_value: 15,
            description: '15% discount for 30+ days early booking'
          }
        ]
      };
      service.suggestPricingRules.mockResolvedValue(mockRules);

      await controller.suggestPricingRules(req, res);

      expect(service.suggestPricingRules).toHaveBeenCalledWith('tenant-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockRules);
    });

    it('returns 200 with email templates suggestions', async () => {
      const mockTemplates = {
        suggestions: [
          {
            name: 'VIP Quote',
            subject: 'Exclusive Proposal for [lead_name]',
            body_html: '<p>Total: [final_price]</p>',
            body_text: 'Total: [final_price]',
            description: 'VIP Quote description',
            content_format: 'html'
          }
        ]
      };
      service.suggestEmailTemplates.mockResolvedValue(mockTemplates);

      await controller.suggestEmailTemplates(req, res);

      expect(service.suggestEmailTemplates).toHaveBeenCalledWith('tenant-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockTemplates);
    });
  });

  describe('Error Handling (500)', () => {
    it('returns 500 when an unexpected internal error occurs in suggestConcepts', async () => {
      service.suggestConcepts.mockRejectedValue(new Error('Database error'));

      await controller.suggestConcepts(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });
});

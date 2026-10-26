process.env.GCS_BUCKET = process.env.GCS_BUCKET || 'test-bucket';

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        download: jest.fn().mockResolvedValue([Buffer.from('template content')]),
      }),
    }),
  })),
}));

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn(),
      pdf: jest.fn(),
    }),
    close: jest.fn(),
  }),
}));

const leadRequirementConfigRepo = require('../../repositories/lead_requirement_config.repository');
const conceptRepo = require('../../repositories/concept.repository');
const pricingRuleRepository = require('../../repositories/pricingRule.repository');
const placeholderRepo = require('../../repositories/quotation-placeholder.repository');
const tenantRepository = require('../../repositories/tenant.repository');
const tenantProfileRepository = require('../../repositories/tenant-profile.repository');

jest.mock('../../repositories/lead_requirement_config.repository');
jest.mock('../../repositories/concept.repository');
jest.mock('../../repositories/pricingRule.repository');
jest.mock('../../repositories/quotation-placeholder.repository');
jest.mock('../../repositories/tenant.repository');
jest.mock('../../repositories/tenant-profile.repository');

describe('AIService - Initialization & Gemini Suggestions', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.GCS_BUCKET = 'test-bucket';
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Soft-initialization & Unconfigured State', () => {
    it('does not throw an exception on boot when GEMINI_API_KEY is missing', () => {
      delete process.env.GEMINI_API_KEY;
      for (let i = 1; i <= 9; i++) {
        delete process.env[`GEMINI_API_KEY_${i}`];
      }

      const aiService = require('../ai-response.service');
      aiService.setupGeminiAPI();

      expect(aiService.isConfigured).toBe(false);
      expect(aiService.geminiModels).toEqual([]);
    });

    it('throws 503 error when suggestConcepts is invoked while unconfigured', async () => {
      const aiService = require('../ai-response.service');
      aiService.isConfigured = false;
      aiService.geminiModels = [];

      await expect(aiService.suggestConcepts('tenant-123')).rejects.toMatchObject({
        message: 'AI service is not configured with valid API keys',
        statusCode: 503
      });
    });

    it('throws 503 error when suggestPricingRules is invoked while unconfigured', async () => {
      const aiService = require('../ai-response.service');
      aiService.isConfigured = false;
      aiService.geminiModels = [];

      await expect(aiService.suggestPricingRules('tenant-123')).rejects.toMatchObject({
        message: 'AI service is not configured with valid API keys',
        statusCode: 503
      });
    });

    it('throws 503 error when suggestEmailTemplates is invoked while unconfigured', async () => {
      const aiService = require('../ai-response.service');
      aiService.isConfigured = false;
      aiService.geminiModels = [];

      await expect(aiService.suggestEmailTemplates('tenant-123')).rejects.toMatchObject({
        message: 'AI service is not configured with valid API keys',
        statusCode: 503
      });
    });
  });

  describe('Configured Suggestions', () => {
    let aiService;
    let mockGenerateContent;

    beforeEach(() => {
      aiService = require('../ai-response.service');
      mockGenerateContent = jest.fn();

      aiService.geminiModels = [
        {
          client: {
            getGenerativeModel: jest.fn().mockReturnValue({
              generateContent: mockGenerateContent
            })
          },
          keyIndex: 0,
          requestsCount: 0,
          lastUsed: null
        }
      ];
      aiService.isConfigured = true;
    });

    it('suggestConcepts generates structured JSON concept tiers with tenant profile context', async () => {
      leadRequirementConfigRepo.findByTenantAndActive.mockResolvedValue([
        { id: 'cfg-1', field_key: 'photography', label: 'Photography', category: 'Media' },
        { id: 'cfg-2', field_key: 'catering', label: 'Catering', category: 'Food' }
      ]);
      tenantRepository.findById.mockResolvedValue({ id: 'tenant-123', name: 'Elite Events', website: 'elite.com' });
      tenantProfileRepository.findByTenantId.mockResolvedValue({ tagline: 'Excellence in every event' });

      const mockResponse = {
        suggestions: [
          {
            name: 'Luxury Experience',
            description: 'Full-service luxury production with media and catering',
            minimum_cost: 5000,
            requirement_configs: [
              { id: 'cfg-1', name: 'Photography' },
              { id: 'cfg-2', name: 'Catering' }
            ]
          }
        ]
      };

      mockGenerateContent.mockResolvedValue({
        response: Promise.resolve({
          text: () => JSON.stringify(mockResponse)
        })
      });

      const result = await aiService.suggestConcepts('tenant-123');

      expect(leadRequirementConfigRepo.findByTenantAndActive).toHaveBeenCalledWith('tenant-123');
      expect(tenantRepository.findById).toHaveBeenCalledWith('tenant-123');
      expect(tenantProfileRepository.findByTenantId).toHaveBeenCalledWith('tenant-123');
      expect(result).toEqual(mockResponse);
      expect(result.suggestions[0]).toHaveProperty('name');
      expect(result.suggestions[0]).toHaveProperty('description');
      expect(result.suggestions[0]).toHaveProperty('minimum_cost');
      expect(result.suggestions[0]).toHaveProperty('requirement_configs');
    });

    it('suggestPricingRules generates schema-compatible dynamic pricing rules', async () => {
      leadRequirementConfigRepo.findByTenantAndActive.mockResolvedValue([
        { id: 'cfg-1', field_key: 'guest_count', label: 'Guest Count', pricing_model: 'per_person' }
      ]);
      conceptRepo.findAll.mockResolvedValue([
        { id: 'c-1', name: 'Premium Gala' }
      ]);

      const mockResponse = {
        suggestions: [
          {
            name: 'Large Gathering Discount',
            target_type: 'service',
            condition_field: 'guest_count',
            condition_name: 'Guest Count',
            condition_operator: '>=',
            condition_value: 200,
            action_type: 'discount',
            action_mode: 'percentage',
            action_value: 10,
            description: 'Apply 10% discount when guest count exceeds 200'
          }
        ]
      };

      mockGenerateContent.mockResolvedValue({
        response: Promise.resolve({
          text: () => JSON.stringify(mockResponse)
        })
      });

      const result = await aiService.suggestPricingRules('tenant-123');

      expect(leadRequirementConfigRepo.findByTenantAndActive).toHaveBeenCalledWith('tenant-123');
      expect(conceptRepo.findAll).toHaveBeenCalledWith('tenant-123');
      expect(result).toEqual(mockResponse);
      expect(result.suggestions[0]).toHaveProperty('name');
      expect(result.suggestions[0]).toHaveProperty('target_type');
      expect(result.suggestions[0]).toHaveProperty('condition_field');
      expect(result.suggestions[0]).toHaveProperty('condition_name');
      expect(result.suggestions[0]).toHaveProperty('condition_operator');
      expect(result.suggestions[0]).toHaveProperty('condition_value');
      expect(result.suggestions[0]).toHaveProperty('action_type');
      expect(result.suggestions[0]).toHaveProperty('action_mode');
      expect(result.suggestions[0]).toHaveProperty('action_value');
      expect(result.suggestions[0]).toHaveProperty('description');
    });

    it('suggestPricingRules returns empty array when no requirement configs or concepts exist', async () => {
      leadRequirementConfigRepo.findByTenantAndActive.mockResolvedValue([]);
      conceptRepo.findAll.mockResolvedValue([]);

      const result = await aiService.suggestPricingRules('tenant-123');
      expect(result).toEqual({ suggestions: [] });
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('suggestEmailTemplates generates HTML email templates with token tags', async () => {
      leadRequirementConfigRepo.findByTenantAndActive.mockResolvedValue([]);
      conceptRepo.findAll.mockResolvedValue([]);
      pricingRuleRepository.findAll.mockResolvedValue([]);
      placeholderRepo.findByTenant.mockResolvedValue([
        { placeholder_key: 'lead_name' },
        { placeholder_key: 'company_name' }
      ]);
      tenantRepository.findById.mockResolvedValue({ id: 'tenant-123', name: 'Elite Events' });
      tenantProfileRepository.findByTenantId.mockResolvedValue({});

      const mockResponse = {
        suggestions: [
          {
            name: 'Quotation Delivery Template',
            subject: 'Proposal for [company_name] - [quotation_id]',
            body_html: '<p>Dear [lead_name], your investment is [final_price].</p>',
            body_text: 'Dear [lead_name], your investment is [final_price].',
            description: 'Standard quotation email',
            content_format: 'html'
          }
        ]
      };

      mockGenerateContent.mockResolvedValue({
        response: Promise.resolve({
          text: () => JSON.stringify(mockResponse)
        })
      });

      const result = await aiService.suggestEmailTemplates('tenant-123');
      const aliasResult = await aiService.suggestEmailTemplete('tenant-123');

      expect(result).toEqual(mockResponse);
      expect(aliasResult).toEqual(mockResponse);
      expect(result.suggestions[0].body_html).toContain('[lead_name]');
      expect(result.suggestions[0].body_html).toContain('[final_price]');
    });
  });
});

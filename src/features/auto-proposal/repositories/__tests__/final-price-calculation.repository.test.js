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

const { calculateFinalPrice, generateFinalPrice } = require('../final-price-calculation.repository');
const dataSource = require('../../../../config/data-source');
const conceptRepository = require('../concept.repository');
const aiService = require('../../services/ai-response.service');
const leadRequirementValueRepository = require('../lead_requirement_values.repository');

jest.mock('../../../../config/data-source', () => ({
  query: jest.fn(),
}));
jest.mock('../concept.repository');
jest.mock('../../services/ai-response.service');
jest.mock('../lead_requirement_values.repository');

describe('FinalPriceCalculationRepository', () => {
  const tenantId = 'tenant-123';
  const leadReqId = 'lead-req-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateFinalPrice', () => {
    it('calculates price when concept matches with package discount and add-on service surcharge', async () => {
      // Lead Data: 2 items (1 in concept, 1 add-on)
      const mockLeadData = [
        {
          value_record_id: 'vr-1',
          value_number: 10,
          field_id: 'field-concept-svc',
          field_key: 'catering_count',
          label: 'Catering Service',
          base_price: 50,
          pricing_model: 'Per Person',
        },
        {
          value_record_id: 'vr-2',
          value_number: 1,
          field_id: 'field-addon-svc',
          field_key: 'dj_setup',
          label: 'DJ Setup',
          base_price: 300,
          pricing_model: 'Fixed',
        },
      ];

      // Rules: 1 Package discount (10%) and 1 Addon service surcharge (Fixed 50)
      const mockRules = [
        {
          id: 'rule-pkg-1',
          tenant_id: tenantId,
          target_type: 'package',
          concept_id: 'concept-gold',
          action_mode: 'percentage',
          action_type: 'discount',
          action_value: 10,
        },
        {
          id: 'rule-addon-1',
          tenant_id: tenantId,
          target_type: 'service',
          requirement_config_id: 'field-addon-svc',
          condition_field: 'field-addon-svc',
          condition_operator: '>=',
          condition_value: 1,
          action_mode: 'fixed',
          action_type: 'surcharge',
          action_value: 50,
        },
      ];

      const mockConcepts = [
        {
          id: 'concept-gold',
          name: 'Gold Package',
          pricing_type: 'tiered',
          minimum_cost: 0,
          requirement_configs: [{ id: 'field-concept-svc' }],
        },
      ];

      dataSource.query
        .mockResolvedValueOnce(mockLeadData) // leadData query
        .mockResolvedValueOnce(mockRules); // rules query
      conceptRepository.findAllWithRequirements.mockResolvedValue(mockConcepts);

      const result = await calculateFinalPrice(tenantId, leadReqId, 'Gold Package');

      expect(result).toBeDefined();
      expect(result.concept_id).toBe('concept-gold');
      expect(result.concept_name).toBe('Gold Package');

      // Concept item: 10 * 50 = 500 base. Package discount 10% on 500 = -50 => 450.
      // Add-on item: Fixed 300 base + 50 surcharge => 350.
      // Final price = 450 + 350 = 800.
      expect(result.final_price).toBe(800);
      expect(result.total_concept_discount).toBe(50);
      expect(result.total_concept_surcharge).toBe(50);
      expect(result.applied_package_rules).toEqual(['rule-pkg-1']);
      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdown[1].applied_rules).toEqual(['rule-addon-1']);
    });

    it('handles fixed pricing model vs variable unit count pricing model', async () => {
      const mockLeadData = [
        {
          value_record_id: 'vr-fixed',
          value_number: 5, // Even though count is 5, Fixed model uses base_price directly
          field_id: 'field-f1',
          field_key: 'stage_lighting',
          label: 'Stage Lighting',
          base_price: 1200,
          pricing_model: 'Fixed',
        },
        {
          value_record_id: 'vr-var',
          value_number: 4,
          field_id: 'field-v1',
          field_key: 'chairs',
          label: 'Chairs',
          base_price: 25,
          pricing_model: 'Per Unit',
        },
      ];

      const mockConcepts = [
        {
          id: 'concept-standard',
          name: 'Standard Event',
          minimum_cost: 0,
          requirement_configs: [{ id: 'field-f1' }, { id: 'field-v1' }],
        },
      ];

      dataSource.query
        .mockResolvedValueOnce(mockLeadData)
        .mockResolvedValueOnce([]); // No rules
      conceptRepository.findAllWithRequirements.mockResolvedValue(mockConcepts);

      const result = await calculateFinalPrice(tenantId, leadReqId, 'Standard Event');

      // Stage Lighting = 1200, Chairs = 4 * 25 = 100
      // Total = 1300
      expect(result.final_price).toBe(1300);
      expect(result.total_base_price).toBe(1300);
      expect(result.breakdown[0].price).toBe(1200);
      expect(result.breakdown[1].price).toBe(100);
    });

    it('evaluates all condition operators: >, <, >=, <=, and =', async () => {
      const mockLeadData = [
        {
          value_record_id: 'vr-op',
          value_number: 50,
          field_id: 'field-guests',
          field_key: 'guest_count',
          label: 'Guests',
          base_price: 10,
          pricing_model: 'Per Person',
        },
      ];

      const operatorsToTest = [
        { op: '>', condVal: 40, expectedMatch: true },
        { op: '>', condVal: 50, expectedMatch: false },
        { op: '<', condVal: 60, expectedMatch: true },
        { op: '<', condVal: 50, expectedMatch: false },
        { op: '>=', condVal: 50, expectedMatch: true },
        { op: '>=', condVal: 51, expectedMatch: false },
        { op: '<=', condVal: 50, expectedMatch: true },
        { op: '<=', condVal: 49, expectedMatch: false },
        { op: '=', condVal: 50, expectedMatch: true },
        { op: '=', condVal: 55, expectedMatch: false },
      ];

      for (const { op, condVal, expectedMatch } of operatorsToTest) {
        const mockRules = [
          {
            id: `rule-test-${op}-${condVal}`,
            tenant_id: tenantId,
            target_type: 'service',
            requirement_config_id: 'field-guests',
            condition_field: 'field-guests',
            condition_operator: op,
            condition_value: condVal,
            action_mode: 'fixed',
            action_type: 'discount',
            action_value: 20,
          },
        ];

        // No concept matches, so it evaluates service rules in fallback
        dataSource.query
          .mockResolvedValueOnce(mockLeadData)
          .mockResolvedValueOnce(mockRules);
        conceptRepository.findAllWithRequirements.mockResolvedValue([]);

        const result = await calculateFinalPrice(tenantId, leadReqId, 'Any');
        const item = result.breakdown[0];

        if (expectedMatch) {
          expect(item.applied_rules).toContain(`rule-test-${op}-${condVal}`);
          expect(item.price).toBe(480); // 50 * 10 - 20
        } else {
          expect(item.applied_rules).toHaveLength(0);
          expect(item.price).toBe(500); // 50 * 10
        }
      }
    });

    it('enforces minimum cost floor commitment by raising final price and appending min_cost_adjustment line item', async () => {
      const mockLeadData = [
        {
          value_record_id: 'vr-1',
          value_number: 1,
          field_id: 'field-c1',
          field_key: 'basic_setup',
          label: 'Basic Setup',
          base_price: 200,
          pricing_model: 'Fixed',
        },
      ];

      const mockConcepts = [
        {
          id: 'concept-vip',
          name: 'VIP Package',
          minimum_cost: 1000,
          requirement_configs: [{ id: 'field-c1' }],
        },
      ];

      dataSource.query
        .mockResolvedValueOnce(mockLeadData)
        .mockResolvedValueOnce([]); // No rules
      conceptRepository.findAllWithRequirements.mockResolvedValue(mockConcepts);

      const result = await calculateFinalPrice(tenantId, leadReqId, 'VIP Package');

      // Base price = 200, minimum cost = 1000. Adjustment = 800.
      expect(result.final_price).toBe(1000);
      expect(result.total_base_price).toBe(1000);

      const minCostItem = result.breakdown.find(b => b.key === 'min_cost_adjustment');
      expect(minCostItem).toBeDefined();
      expect(minCostItem.price).toBe(800);
      expect(minCostItem.total_surcharge).toBe(800);
      expect(minCostItem.label).toContain('Minimum Package Commitment (VIP Package)');
    });

    it('generates fallback Custom Service Quote when no concept matches lead requirements', async () => {
      const mockLeadData = [
        {
          value_record_id: 'vr-standalone',
          value_number: 2,
          field_id: 'field-custom',
          field_key: 'custom_lighting',
          label: 'Custom Lighting',
          base_price: 150,
          pricing_model: 'Per Unit',
        },
      ];

      // Concepts require field-other, so match fails
      const mockConcepts = [
        {
          id: 'concept-unmatched',
          name: 'Unmatched Tier',
          requirement_configs: [{ id: 'field-other' }],
        },
      ];

      const mockRules = [
        {
          id: 'rule-standalone-1',
          tenant_id: tenantId,
          target_type: 'service',
          requirement_config_id: 'field-custom',
          condition_field: 'field-custom',
          condition_operator: '>=',
          condition_value: 1,
          action_mode: 'percentage',
          action_type: 'surcharge',
          action_value: 20,
        },
      ];

      dataSource.query
        .mockResolvedValueOnce(mockLeadData)
        .mockResolvedValueOnce(mockRules);
      conceptRepository.findAllWithRequirements.mockResolvedValue(mockConcepts);

      const result = await calculateFinalPrice(tenantId, leadReqId, 'Custom Event');

      expect(result.concept_id).toBeNull();
      expect(result.concept_name).toBe('Custom Service Quote');
      expect(result.pricing_type).toBe('service_only');
      // 2 * 150 = 300 base. 20% surcharge = 60. Final = 360.
      expect(result.total_base_price).toBe(300);
      expect(result.final_price).toBe(360);
      expect(result.total_concept_surcharge).toBe(60);
      expect(result.total_surcharge_percentage).toBe(20);
    });

    it('tie-breaks multiple matching concepts by case-insensitive event_type match', async () => {
      const mockLeadData = [
        {
          value_record_id: 'vr-1',
          value_number: 1,
          field_id: 'field-common',
          field_key: 'hall_rental',
          label: 'Hall Rental',
          base_price: 500,
          pricing_model: 'Fixed',
        },
      ];

      const mockConcepts = [
        {
          id: 'concept-wedding',
          name: 'Wedding Gala',
          requirement_configs: [{ id: 'field-common' }],
        },
        {
          id: 'concept-corporate',
          name: 'Corporate Summit',
          requirement_configs: [{ id: 'field-common' }],
        },
      ];

      dataSource.query
        .mockResolvedValueOnce(mockLeadData)
        .mockResolvedValueOnce([]);
      conceptRepository.findAllWithRequirements.mockResolvedValue(mockConcepts);

      const result = await calculateFinalPrice(tenantId, leadReqId, 'corporate summit');

      expect(result.concept_id).toBe('concept-corporate');
      expect(result.concept_name).toBe('Corporate Summit');
    });
  });

  describe('generateFinalPrice', () => {
    it('returns calculated price directly when price is greater than 0', async () => {
      const mockLeadData = [
        {
          value_record_id: 'vr-1',
          value_number: 2,
          field_id: 'field-c1',
          field_key: 'tables',
          label: 'Tables',
          base_price: 100,
          pricing_model: 'Per Unit',
        },
      ];

      dataSource.query
        .mockResolvedValueOnce(mockLeadData)
        .mockResolvedValueOnce([]);
      conceptRepository.findAllWithRequirements.mockResolvedValue([
        {
          id: 'c-1',
          name: 'Basic',
          requirement_configs: [{ id: 'field-c1' }],
        },
      ]);

      const result = await generateFinalPrice(tenantId, leadReqId, 'Customer inquiry email', 'Basic');

      expect(result.final_price).toBe(200);
      expect(aiService.callConsultantAI).not.toHaveBeenCalled();
      expect(leadRequirementValueRepository.saveRequirementValues).not.toHaveBeenCalled();
    });

    it('triggers AI consultant fallback on zero-total price, saves suggested requirements, and merges breakdowns', async () => {
      // 1st calculateFinalPrice call returns 0 total price
      const mockLeadDataEmpty = [
        {
          value_record_id: 'vr-0',
          value_number: 0,
          field_id: 'field-c1',
          field_key: 'tables',
          label: 'Tables',
          base_price: 0,
          pricing_model: 'Fixed',
        },
      ];

      // 2nd calculateFinalPrice call (after AI suggestions applied) returns discovered services
      const mockLeadDataDiscovered = [
        {
          value_record_id: 'vr-0',
          value_number: 0,
          field_id: 'field-c1',
          field_key: 'tables',
          label: 'Tables',
          base_price: 0,
          pricing_model: 'Fixed',
        },
        {
          value_record_id: 'vr-ai',
          value_number: 1,
          field_id: 'field-discovered',
          field_key: 'photography',
          label: 'Photography Package',
          base_price: 750,
          pricing_model: 'Fixed',
        },
      ];

      dataSource.query
        .mockResolvedValueOnce(mockLeadDataEmpty) // First calculate query: leadData
        .mockResolvedValueOnce([]) // First calculate query: rules
        .mockResolvedValueOnce(mockLeadDataDiscovered) // Second calculate query: leadData
        .mockResolvedValueOnce([]); // Second calculate query: rules

      conceptRepository.findAllWithRequirements
        .mockResolvedValueOnce([
          {
            id: 'c-1',
            name: 'Basic',
            requirement_configs: [{ id: 'field-c1' }],
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'c-1',
            name: 'Basic',
            requirement_configs: [{ id: 'field-c1' }],
          },
        ]);

      aiService.callConsultantAI.mockResolvedValue({ photography: 1 });
      leadRequirementValueRepository.saveRequirementValues.mockResolvedValue([{ id: 'saved-1' }]);

      const result = await generateFinalPrice(
        tenantId,
        leadReqId,
        'We need professional photography for our party',
        'Basic'
      );

      expect(aiService.callConsultantAI).toHaveBeenCalledWith(
        tenantId,
        'We need professional photography for our party'
      );
      expect(leadRequirementValueRepository.saveRequirementValues).toHaveBeenCalledWith(
        tenantId,
        leadReqId,
        { photography: 1 }
      );
      expect(result).toBeDefined();
      expect(result.final_price).toBe(750);
      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdown.find(b => b.key === 'photography').price).toBe(750);
    });
  });
});

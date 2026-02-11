const pricingEngineService = require('../../../../../src/features/pricing/services/pricing-engine.service');
const pricingRulesRepository = require('../repositories/pricing-rules.repository');

async function calculate(req, res, next) {
  try {
    const { concept_id, location_id, quantity, lead_requirement_id } = req.body;
    if (!concept_id) {
      return res.status(400).json({ error: 'concept_id is required' });
    }
    const result = await pricingEngineService.calculatePrice(req.tenantId, {
      conceptId: concept_id,
      locationId: location_id,
      quantity,
      leadRequirementId: lead_requirement_id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function createRule(req, res, next) {
  try {
    const { name, rule_type, parameters, evaluation_order, is_active } = req.body;
    if (!name || !rule_type) {
      return res.status(400).json({ error: 'name and rule_type are required' });
    }
    const rule = await pricingRulesRepository.create(req.tenantId, {
      name,
      rule_type,
      parameters,
      evaluation_order,
      is_active,
    });
    res.status(201).json({
      id: rule.id,
      tenant_id: rule.tenant_id,
      name: rule.name,
      rule_type: rule.rule_type,
      parameters: rule.parameters,
      evaluation_order: rule.evaluation_order,
      is_active: rule.is_active,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  calculate,
  createRule,
};

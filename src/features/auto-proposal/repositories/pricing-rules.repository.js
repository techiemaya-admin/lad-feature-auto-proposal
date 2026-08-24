const { v4: uuidv4 } = require('uuid');
const dataSource = require('../../../config/data-source');

function getRepository() {
  return dataSource.getRepository('PricingRule');
}

async function create(tenantId, data) {
  const repo = getRepository();
  const entity = repo.create({
    id: uuidv4(),
    tenant_id: tenantId,
    name: data.name,
    rule_type: data.rule_type,
    parameters: data.parameters ?? null,
    evaluation_order: data.evaluation_order ?? 0,
    is_active: data.is_active !== false,
  });
  return repo.save(entity);
}

/** List active pricing rules for tenant, ordered by evaluation_order. */
async function findActiveByTenant(tenantId) {
  const repo = getRepository();
  return repo.find({
    where: { tenant_id: tenantId, is_deleted: false, is_active: true },
    order: { evaluation_order: 'ASC' },
  });
}

module.exports = {
  create,
  findActiveByTenant,
};

const { v4: uuidv4 } = require('uuid');
const dataSource = require('../../../config/data-source');

function getRepository() {
  return dataSource.getRepository('QuotationTemplateMetadata');
}

async function create(tenantId, data) {
  const repo = getRepository();
  const entity = repo.create({
    id: uuidv4(),
    tenant_id: tenantId,
    name: data.name,
    template_key: data.template_key || null,
    structure: data.structure || null,
    is_default: data.is_default === true,
  });
  return repo.save(entity);
}

async function findById(tenantId, id) {
  const repo = getRepository();
  return repo.findOne({ where: { id, tenant_id: tenantId, is_deleted: false } });
}

async function findAll(tenantId, limit = 100, offset = 0) {
  const repo = getRepository();
  return repo.find({ where: { tenant_id: tenantId, is_deleted: false }, take: limit, skip: offset, order: { created_at: 'DESC' } });
}

async function findDefault(tenantId) {
  const repo = getRepository();
  return repo.findOne({ where: { tenant_id: tenantId, is_deleted: false, is_default: true } });
}

async function setDefault(tenantId, id) {
  const repo = getRepository();
  await repo.update({ tenant_id: tenantId, is_deleted: false }, { is_default: false });
  await repo.update({ id, tenant_id: tenantId, is_deleted: false }, { is_default: true });
  return findById(tenantId, id);
}

module.exports = {
  create,
  findById,
  findAll,
  findDefault,
  setDefault,
};

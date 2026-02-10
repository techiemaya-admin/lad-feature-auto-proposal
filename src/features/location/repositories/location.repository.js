const { v4: uuidv4 } = require('uuid');
const dataSource = require('../../../config/data-source');

function getRepository() {
  return dataSource.getRepository('Location');
}

async function create(tenantId, data) {
  const repo = getRepository();
  const entity = repo.create({
    id: uuidv4(),
    tenant_id: tenantId,
    name: data.name,
    code: data.code || null,
    timezone: data.timezone || null,
    metadata: data.metadata || null,
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

module.exports = {
  create,
  findById,
  findAll,
};

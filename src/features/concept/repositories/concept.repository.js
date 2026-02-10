const { v4: uuidv4 } = require('uuid');
const { In } = require('typeorm');
const dataSource = require('../../../config/data-source');

function getRepository() {
  return dataSource.getRepository('Concept');
}

async function create(tenantId, data) {
  const repo = getRepository();
  const entity = repo.create({
    id: uuidv4(),
    tenant_id: tenantId,
    ...data,
  });
  return repo.save(entity);
}

async function findById(tenantId, id) {
  const repo = getRepository();
  return repo.findOne({
    where: { id, tenant_id: tenantId, is_deleted: false },
  });
}

async function findAll(tenantId, limit = 100, offset = 0) {
  const repo = getRepository();
  return repo.find({
    where: { tenant_id: tenantId, is_deleted: false },
    take: limit,
    skip: offset,
    order: { created_at: 'DESC' },
  });
}

async function findByIds(tenantId, ids) {
  if (!ids || ids.length === 0) return [];
  const repo = getRepository();
  return repo.find({
    where: { tenant_id: tenantId, is_deleted: false, id: In(ids) },
  });
}

module.exports = {
  create,
  findById,
  findAll,
  findByIds,
};

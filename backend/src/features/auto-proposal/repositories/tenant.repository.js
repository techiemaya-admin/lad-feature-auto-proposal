const { v4: uuidv4 } = require('uuid');
const dataSource = require('../../../config/data-source');

function getTenantRepository() {
  return dataSource.getRepository('Tenant');
}

async function create(tenantData) {
  const repo = getTenantRepository();
  const entity = repo.create({
    id: uuidv4(),
    ...tenantData,
  });
  return repo.save(entity);
}

async function findById(id) {
  const repo = getTenantRepository();
  return repo.findOne({
    where: { id, is_deleted: false },
  });
}

async function findBySlug(slug) {
  const repo = getTenantRepository();
  return repo.findOne({
    where: { slug, is_deleted: false },
  });
}

async function findAll(limit = 100, offset = 0) {
  const repo = getTenantRepository();
  return repo.find({
    where: { is_deleted: false },
    take: limit,
    skip: offset,
    order: { created_at: 'DESC' },
  });
}

module.exports = {
  create,
  findById,
  findBySlug,
  findAll,
};

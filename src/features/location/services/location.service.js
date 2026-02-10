const locationRepository = require('../../../repositories/location.repository');

async function createLocation(tenantId, data) {
  if (!data.name) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }
  return locationRepository.create(tenantId, data);
}

async function getLocationById(tenantId, id) {
  const location = await locationRepository.findById(tenantId, id);
  if (!location) {
    const err = new Error('Location not found');
    err.statusCode = 404;
    throw err;
  }
  return location;
}

async function listLocations(tenantId, limit, offset) {
  return locationRepository.findAll(tenantId, limit, offset);
}

module.exports = {
  createLocation,
  getLocationById,
  listLocations,
};

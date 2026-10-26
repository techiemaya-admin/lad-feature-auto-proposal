const locationService = require('../services/location.service');
const { createLocationDto, toLocationResponse } = require('../dtos/location.dto');

async function create(req, res, next) {
  try {
    const dto = createLocationDto(req.body);
    const location = await locationService.createLocation(req.tenantId, dto);
    res.status(201).json(toLocationResponse(location));
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const location = await locationService.getLocationById(req.tenantId, req.params.id);
    res.json(toLocationResponse(location));
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const locations = await locationService.listLocations(req.tenantId, limit, offset);
    res.json(locations.map(toLocationResponse));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  getById,
  list,
};

const conceptService = require('../concept.service');
const conceptRepository = require('../../repositories/concept.repository');
const conceptLocationRepository = require('../../repositories/concept-location.repository');
const conceptPricingMatrixRepository = require('../../repositories/concept-pricing-matrix.repository');
const locationRepository = require('../../repositories/location.repository');

jest.mock('../../repositories/concept.repository');
jest.mock('../../repositories/concept-location.repository');
jest.mock('../../repositories/concept-pricing-matrix.repository');
jest.mock('../../repositories/location.repository');

describe('ConceptService', () => {
  const tenantId = 'tenant-123';
  const conceptId = 'concept-456';
  const locationId = 'loc-789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createConcept', () => {
    it('throws 400 when name is missing or empty', async () => {
      await expect(conceptService.createConcept(tenantId, { description: 'No name' }))
        .rejects.toMatchObject({
          message: 'name is required',
          statusCode: 400,
        });

      expect(conceptRepository.create).not.toHaveBeenCalled();
    });

    it('creates and returns concept when name is provided', async () => {
      const payload = { name: 'Premium Gala', minimum_cost: 5000 };
      conceptRepository.create.mockResolvedValue({ id: conceptId, ...payload });

      const result = await conceptService.createConcept(tenantId, payload);

      expect(conceptRepository.create).toHaveBeenCalledWith(tenantId, payload);
      expect(result).toEqual({ id: conceptId, ...payload });
    });
  });

  describe('getConceptById', () => {
    it('throws 404 when concept does not exist for tenant', async () => {
      conceptRepository.findById.mockResolvedValue(null);

      await expect(conceptService.getConceptById(tenantId, conceptId))
        .rejects.toMatchObject({
          message: 'Concept not found',
          statusCode: 404,
        });

      expect(conceptRepository.findById).toHaveBeenCalledWith(tenantId, conceptId);
    });

    it('returns concept when found', async () => {
      const mockConcept = { id: conceptId, name: 'Executive Suite' };
      conceptRepository.findById.mockResolvedValue(mockConcept);

      const result = await conceptService.getConceptById(tenantId, conceptId);

      expect(conceptRepository.findById).toHaveBeenCalledWith(tenantId, conceptId);
      expect(result).toEqual(mockConcept);
    });
  });

  describe('listConcepts', () => {
    it('delegates to conceptRepository.findAllWithRequirements', async () => {
      const mockConcepts = [{ id: 'c-1', name: 'Concept A' }, { id: 'c-2', name: 'Concept B' }];
      conceptRepository.findAllWithRequirements.mockResolvedValue(mockConcepts);

      const result = await conceptService.listConcepts(tenantId);

      expect(conceptRepository.findAllWithRequirements).toHaveBeenCalledWith(tenantId);
      expect(result).toEqual(mockConcepts);
    });
  });

  describe('listConceptsByLocation', () => {
    it('returns empty array when location has no associated concept IDs', async () => {
      locationRepository.findById.mockResolvedValue({ id: locationId });
      conceptLocationRepository.findConceptIdsByLocation.mockResolvedValue([]);

      const result = await conceptService.listConceptsByLocation(tenantId, locationId);

      expect(locationRepository.findById).toHaveBeenCalledWith(tenantId, locationId);
      expect(conceptLocationRepository.findConceptIdsByLocation).toHaveBeenCalledWith(tenantId, locationId);
      expect(conceptRepository.findByIds).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('queries and returns concepts by IDs when associated concepts exist', async () => {
      locationRepository.findById.mockResolvedValue({ id: locationId });
      conceptLocationRepository.findConceptIdsByLocation.mockResolvedValue(['c-1', 'c-2']);
      const mockConcepts = [{ id: 'c-1', name: 'Tier 1' }, { id: 'c-2', name: 'Tier 2' }];
      conceptRepository.findByIds.mockResolvedValue(mockConcepts);

      const result = await conceptService.listConceptsByLocation(tenantId, locationId);

      expect(conceptRepository.findByIds).toHaveBeenCalledWith(tenantId, ['c-1', 'c-2']);
      expect(result).toEqual(mockConcepts);
    });
  });

  describe('linkConceptToLocation', () => {
    it('throws 409 when concept is already linked to location', async () => {
      conceptRepository.findById.mockResolvedValue({ id: conceptId });
      locationRepository.findById.mockResolvedValue({ id: locationId });
      conceptLocationRepository.findByConceptAndLocation.mockResolvedValue({ id: 'existing-link' });

      await expect(conceptService.linkConceptToLocation(tenantId, conceptId, locationId))
        .rejects.toMatchObject({
          message: 'Concept already linked to this location',
          statusCode: 409,
        });

      expect(conceptLocationRepository.create).not.toHaveBeenCalled();
    });

    it('creates link when concept and location exist and are not already linked', async () => {
      conceptRepository.findById.mockResolvedValue({ id: conceptId });
      locationRepository.findById.mockResolvedValue({ id: locationId });
      conceptLocationRepository.findByConceptAndLocation.mockResolvedValue(null);
      conceptLocationRepository.create.mockResolvedValue({ id: 'new-link-id', concept_id: conceptId, location_id: locationId });

      const result = await conceptService.linkConceptToLocation(tenantId, conceptId, locationId, { is_primary: true });

      expect(conceptLocationRepository.create).toHaveBeenCalledWith(
        tenantId,
        conceptId,
        locationId,
        { is_primary: true }
      );
      expect(result).toEqual({ id: 'new-link-id', concept_id: conceptId, location_id: locationId });
    });
  });

  describe('addPricing', () => {
    it('throws 400 when base_price is missing or null', async () => {
      await expect(conceptService.addPricing(tenantId, conceptId, { notes: 'Missing price' }))
        .rejects.toMatchObject({
          message: 'base_price is required',
          statusCode: 400,
        });

      expect(conceptPricingMatrixRepository.create).not.toHaveBeenCalled();
    });

    it('validates concept existence and creates pricing matrix entry', async () => {
      conceptRepository.findById.mockResolvedValue({ id: conceptId });
      const pricingData = { base_price: 1500, min_units: 10 };
      conceptPricingMatrixRepository.create.mockResolvedValue({ id: 'pricing-1', ...pricingData });

      const result = await conceptService.addPricing(tenantId, conceptId, pricingData);

      expect(conceptRepository.findById).toHaveBeenCalledWith(tenantId, conceptId);
      expect(conceptPricingMatrixRepository.create).toHaveBeenCalledWith(tenantId, conceptId, pricingData);
      expect(result).toEqual({ id: 'pricing-1', ...pricingData });
    });
  });

  describe('updateConcept', () => {
    it('validates concept existence (404) before updating', async () => {
      conceptRepository.findById.mockResolvedValue(null);

      await expect(conceptService.updateConcept(tenantId, conceptId, { name: 'New Name' }))
        .rejects.toMatchObject({
          message: 'Concept not found',
          statusCode: 404,
        });

      expect(conceptRepository.update).not.toHaveBeenCalled();
    });

    it('updates and returns concept when concept exists', async () => {
      conceptRepository.findById.mockResolvedValue({ id: conceptId, name: 'Old Name' });
      conceptRepository.update.mockResolvedValue({ id: conceptId, name: 'Updated Name' });

      const result = await conceptService.updateConcept(tenantId, conceptId, { name: 'Updated Name' });

      expect(conceptRepository.update).toHaveBeenCalledWith(tenantId, conceptId, { name: 'Updated Name' });
      expect(result).toEqual({ id: conceptId, name: 'Updated Name' });
    });
  });

  describe('deleteConcept', () => {
    it('passes tenantId and id to conceptRepository.softDelete', async () => {
      conceptRepository.softDelete.mockResolvedValue({ id: conceptId });

      const result = await conceptService.deleteConcept(tenantId, conceptId);

      expect(conceptRepository.softDelete).toHaveBeenCalledWith(tenantId, conceptId);
      expect(result).toEqual({ id: conceptId });
    });
  });
});

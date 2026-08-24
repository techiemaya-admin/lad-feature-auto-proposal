const conceptService = require('../concept.service');
const conceptRepository = require('../../repositories/concept.repository');

jest.mock('../../repositories/concept.repository');

describe('ConceptService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteConcept', () => {
    it('passes tenantId and id to conceptRepository.softDelete', async () => {
      conceptRepository.softDelete.mockResolvedValue({ id: 'concept-1' });

      const result = await conceptService.deleteConcept('tenant-123', 'concept-1');

      expect(conceptRepository.softDelete).toHaveBeenCalledWith('tenant-123', 'concept-1');
      expect(result).toEqual({ id: 'concept-1' });
    });
  });
});

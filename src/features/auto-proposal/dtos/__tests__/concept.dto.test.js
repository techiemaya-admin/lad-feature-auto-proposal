const { createConceptDto, toConceptResponse } = require('../concept.dto');

describe('Concept DTO', () => {
  describe('createConceptDto', () => {
    it('creates DTO using explicit requirement_config_ids', () => {
      const body = {
        name: 'Platinum Package',
        description: 'All-inclusive premium concept',
        metadata: { tier: 'top' },
        minimum_cost: 2500,
        requirement_config_ids: ['rc-1', 'rc-2'],
      };

      const dto = createConceptDto(body);

      expect(dto).toEqual({
        name: 'Platinum Package',
        description: 'All-inclusive premium concept',
        metadata: { tier: 'top' },
        minimum_cost: 2500,
        requirement_config_ids: ['rc-1', 'rc-2'],
      });
    });

    it('falls back to requirement_configs when requirement_config_ids is not provided', () => {
      const body = {
        name: 'Standard Package',
        description: 'Standard event concept',
        minimum_cost: 1000,
        requirement_configs: ['rc-3', 'rc-4'],
      };

      const dto = createConceptDto(body);

      expect(dto.requirement_config_ids).toEqual(['rc-3', 'rc-4']);
      expect(dto.minimum_cost).toBe(1000);
    });

    it('handles defaults when optional properties are omitted', () => {
      const body = {
        name: 'Basic Concept',
      };

      const dto = createConceptDto(body);

      expect(dto).toEqual({
        name: 'Basic Concept',
        description: null,
        metadata: null,
        minimum_cost: 0,
        requirement_config_ids: [],
      });
    });
  });

  describe('toConceptResponse', () => {
    it('returns null when entity is falsy', () => {
      expect(toConceptResponse(null)).toBeNull();
      expect(toConceptResponse(undefined)).toBeNull();
    });

    it('maps database entity to concept response contract', () => {
      const entity = {
        id: 'c-100',
        tenant_id: 'tenant-001',
        name: 'Executive Suite',
        code: 'EXEC-01',
        description: 'Executive concept tier',
        metadata: { featured: true },
        created_at: '2026-08-27T00:00:00.000Z',
        updated_at: '2026-08-27T00:00:00.000Z',
      };

      const response = toConceptResponse(entity);

      expect(response).toEqual({
        id: 'c-100',
        tenant_id: 'tenant-001',
        name: 'Executive Suite',
        code: 'EXEC-01',
        description: 'Executive concept tier',
        metadata: { featured: true },
        created_at: '2026-08-27T00:00:00.000Z',
        updated_at: '2026-08-27T00:00:00.000Z',
      });
    });
  });
});

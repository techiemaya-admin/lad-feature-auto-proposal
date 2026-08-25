const db = require('../../../../config/data-source');
const conceptRepository = require('../concept.repository');

jest.mock('../../../../config/data-source', () => ({
  query: jest.fn(),
}));

describe('ConceptRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('softDelete', () => {
    it('executes parameterized UPDATE query filtering by both id and tenant_id', async () => {
      db.query.mockResolvedValue([{ id: 'concept-1' }]);

      const result = await conceptRepository.softDelete('tenant-123', 'concept-1');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('UPDATE concept SET is_deleted = true');
      expect(sql).toContain('WHERE id = $1 AND tenant_id = $2');
      expect(values).toEqual(['concept-1', 'tenant-123']);
      expect(result).toEqual({ id: 'concept-1' });
    });
  });

  describe('hardDelete', () => {
    it('executes parameterized DELETE query filtering by both id and tenant_id', async () => {
      db.query.mockResolvedValue([{ id: 'concept-1' }]);

      const result = await conceptRepository.hardDelete('tenant-123', 'concept-1');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM concept');
      expect(sql).toContain('WHERE id = $1 AND tenant_id = $2');
      expect(values).toEqual(['concept-1', 'tenant-123']);
      expect(result).toEqual({ id: 'concept-1' });
    });
  });

  describe('findByIds', () => {
    it('queries database with ANY filter and tenant isolation', async () => {
      db.query.mockResolvedValue([
        { id: 'c-1', name: 'Concept 1', requirement_configs: [] },
        { id: 'c-2', name: 'Concept 2', requirement_configs: [] },
      ]);

      const result = await conceptRepository.findByIds('tenant-123', ['c-1', 'c-2']);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/WHERE\s+c\.tenant_id\s*=\s*\$1\s+AND\s+c\.id\s*=\s*ANY\(\$2\)/i),
        ['tenant-123', ['c-1', 'c-2']]
      );
      expect(result).toHaveLength(2);
    });

    it('returns empty array when empty array is passed without running database query', async () => {
      const result = await conceptRepository.findByIds('tenant-123', []);
      expect(result).toEqual([]);
      expect(db.query).not.toHaveBeenCalled();
    });
  });
});


const db = require('../../../../config/data-source');
const gmailWatchRepository = require('../gmail-watch.repository');

jest.mock('../../../../config/data-source', () => ({
  query: jest.fn(),
}));

describe('GmailWatchRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('executes parameterized INSERT with tenant_id and watch details', async () => {
      db.query.mockResolvedValue([{ id: 'watch-1', tenant_id: 'tenant-100' }]);

      const data = {
        tenant_id: 'tenant-100',
        user_identities_id: 'identity-200',
        history_id: 'hist-300',
        expiration: '1700000000000'
      };

      const result = await gmailWatchRepository.create(data);

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO gmail_watch');
      expect(values).toEqual([
        'tenant-100',
        'identity-200',
        'hist-300',
        '1700000000000'
      ]);
      expect(result).toEqual({ id: 'watch-1', tenant_id: 'tenant-100' });
    });
  });

  describe('findByUserIdentity', () => {
    it('executes parameterized query including tenant_id when provided', async () => {
      db.query.mockResolvedValue([{ id: 'watch-1', user_identities_id: 'identity-1' }]);

      const result = await gmailWatchRepository.findByUserIdentity('identity-1', 'tenant-123');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('user_identities_id = $1');
      expect(sql).toContain('tenant_id = $2');
      expect(values).toEqual(['identity-1', 'tenant-123']);
      expect(result).toEqual({ id: 'watch-1', user_identities_id: 'identity-1' });
    });

    it('falls back to single-parameter query if tenant_id is omitted', async () => {
      db.query.mockResolvedValue([{ id: 'watch-1' }]);

      await gmailWatchRepository.findByUserIdentity('identity-1');

      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('user_identities_id = $1');
      expect(sql).not.toContain('tenant_id = $2');
      expect(values).toEqual(['identity-1']);
    });
  });

  describe('updateHistory', () => {
    it('includes tenant_id in update where clause when provided', async () => {
      db.query.mockResolvedValue([{ id: 'watch-1', history_id: 'new-hist' }]);

      const updateData = {
        user_identities_id: 'identity-1',
        history_id: 'new-hist',
        expiration: '1800000000',
        tenant_id: 'tenant-123'
      };

      const result = await gmailWatchRepository.updateHistory(updateData);

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('WHERE user_identities_id = $1');
      expect(sql).toContain('AND tenant_id = $4');
      expect(values).toEqual([
        'identity-1',
        'new-hist',
        '1800000000',
        'tenant-123'
      ]);
      expect(result).toEqual({ id: 'watch-1', history_id: 'new-hist' });
    });
  });

  describe('deleteByUserIdentity', () => {
    it('executes parameterized delete scoped to tenant_id', async () => {
      db.query.mockResolvedValue([{ id: 'watch-1' }]);

      const result = await gmailWatchRepository.deleteByUserIdentity('identity-1', 'tenant-123');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('WHERE user_identities_id = $1');
      expect(sql).toContain('AND tenant_id = $2');
      expect(values).toEqual(['identity-1', 'tenant-123']);
      expect(result).toEqual({ id: 'watch-1' });
    });
  });
});

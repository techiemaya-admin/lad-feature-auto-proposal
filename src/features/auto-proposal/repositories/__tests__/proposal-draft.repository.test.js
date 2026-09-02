const db = require('../../../../config/data-source');
const proposalDraftItemRepository = require('../proposal-draft-items.repository');
const proposalDraftRepository = require('../proposal-draft.repository');

jest.mock('../../../../config/data-source', () => ({
  query: jest.fn(),
}));

jest.mock('../proposal-draft-items.repository', () => ({
  bulkCreate: jest.fn(),
  findByProposalDraftId: jest.fn(),
  deleteByProposalId: jest.fn(),
  findItemsByMessageId: jest.fn(),
}));

describe('ProposalDraftRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws an error if data is missing or tenant_id is not provided', async () => {
      await expect(proposalDraftRepository.create(null)).rejects.toThrow(
        'tenant_id is strictly required to create a proposal draft'
      );
      await expect(proposalDraftRepository.create({})).rejects.toThrow(
        'tenant_id is strictly required to create a proposal draft'
      );
      await expect(proposalDraftRepository.create({ final_price: 500 })).rejects.toThrow(
        'tenant_id is strictly required to create a proposal draft'
      );
      expect(db.query).not.toHaveBeenCalled();
    });

    it('creates draft with tenant_id and does not invoke bulkCreate when no breakdown exists', async () => {
      db.query.mockResolvedValue([{ id: 'draft-101', tenant_id: 'tenant-123' }]);

      const result = await proposalDraftRepository.create({
        tenant_id: 'tenant-123',
        lead_requirement_id: 'req-1',
        final_price: 1200,
        status: 'DRAFTED',
      });

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO proposal_draft');
      expect(values[0]).toBe('tenant-123');
      expect(values[1]).toBe('req-1');
      expect(values[2]).toBe(1200);
      expect(proposalDraftItemRepository.bulkCreate).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'draft-101', tenant_id: 'tenant-123' });
    });

    it('creates draft and maps breakdown into bulkCreate with matching tenant_id', async () => {
      db.query.mockResolvedValue([{ id: 'draft-202', tenant_id: 'tenant-abc' }]);
      proposalDraftItemRepository.bulkCreate.mockResolvedValue([]);

      const draftPayload = {
        tenant_id: 'tenant-abc',
        lead_requirement_id: 'req-2',
        final_price: 2500,
        calculation_snapshot: {
          concept_name: 'IMPACT',
          breakdown: [
            {
              label: 'Photography',
              count: 2,
              price: 1500,
              applied_rules: ['rule-1'],
              total_discount: 100,
              total_surcharge: 0,
            },
          ],
        },
      };

      const result = await proposalDraftRepository.create(draftPayload);

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(proposalDraftItemRepository.bulkCreate).toHaveBeenCalledWith([
        {
          tenant_id: 'tenant-abc',
          proposal_draft_id: 'draft-202',
          concept_name: 'IMPACT',
          label: 'Photography',
          unit_count: 2,
          total_price: 1500,
          applied_rules: [
            {
              rule_id: 'rule-1',
              discount: 100,
              surcharge: 0,
            },
          ],
        },
      ]);
      expect(result).toEqual({ id: 'draft-202', tenant_id: 'tenant-abc' });
    });
  });

  describe('findDraftById', () => {
    it('executes parameterized SELECT query without tenant filter when tenantId is omitted', async () => {
      db.query.mockResolvedValue([{ id: 'draft-1', is_deleted: false }]);

      const result = await proposalDraftRepository.findDraftById('draft-1');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('WHERE id = $1');
      expect(sql).not.toContain('AND tenant_id');
      expect(values).toEqual(['draft-1']);
      expect(result).toEqual({ id: 'draft-1', is_deleted: false });
    });

    it('executes parameterized SELECT query filtering by tenant_id when tenantId is provided', async () => {
      db.query.mockResolvedValue([{ id: 'draft-1', tenant_id: 'tenant-123' }]);

      const result = await proposalDraftRepository.findDraftById('draft-1', 'tenant-123');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('WHERE id = $1');
      expect(sql).toContain('AND tenant_id = $2');
      expect(values).toEqual(['draft-1', 'tenant-123']);
      expect(result).toEqual({ id: 'draft-1', tenant_id: 'tenant-123' });
    });
  });

  describe('approveProposalDraft', () => {
    it('executes parameterized UPDATE query without tenant filter when tenantId is omitted', async () => {
      db.query.mockResolvedValue([{ id: 'draft-1', status: 'APPROVED' }]);

      const result = await proposalDraftRepository.approveProposalDraft('draft-1');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain("SET status = 'APPROVED'");
      expect(sql).not.toContain('AND tenant_id');
      expect(values).toEqual(['draft-1']);
      expect(result).toEqual({ id: 'draft-1', status: 'APPROVED' });
    });

    it('executes parameterized UPDATE query filtering by tenant_id when tenantId is provided', async () => {
      db.query.mockResolvedValue([{ id: 'draft-1', status: 'APPROVED', tenant_id: 'tenant-123' }]);

      const result = await proposalDraftRepository.approveProposalDraft('draft-1', 'tenant-123');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain("SET status = 'APPROVED'");
      expect(sql).toContain('AND tenant_id = $2');
      expect(values).toEqual(['draft-1', 'tenant-123']);
      expect(result).toEqual({ id: 'draft-1', status: 'APPROVED', tenant_id: 'tenant-123' });
    });
  });

  describe('findById', () => {
    it('executes parameterized SELECT query with tenant isolation when tenantId is provided', async () => {
      db.query.mockResolvedValue([{ id: 'draft-1', tenant_id: 'tenant-xyz' }]);

      const result = await proposalDraftRepository.findById('draft-1', 'tenant-xyz');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('AND tenant_id = $2');
      expect(values).toEqual(['draft-1', 'tenant-xyz']);
      expect(result).toEqual({ id: 'draft-1', tenant_id: 'tenant-xyz' });
    });
  });

  describe('updateStatus', () => {
    it('executes parameterized UPDATE status query with tenant isolation when tenantId is provided', async () => {
      db.query.mockResolvedValue([{ id: 'draft-1', status: 'REJECTED', tenant_id: 'tenant-xyz' }]);

      const result = await proposalDraftRepository.updateStatus('draft-1', 'REJECTED', 'tenant-xyz');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('SET status = $1');
      expect(sql).toContain('WHERE id = $2');
      expect(sql).toContain('AND tenant_id = $3');
      expect(values).toEqual(['REJECTED', 'draft-1', 'tenant-xyz']);
      expect(result).toEqual({ id: 'draft-1', status: 'REJECTED', tenant_id: 'tenant-xyz' });
    });
  });

  describe('update', () => {
    it('executes parameterized UPDATE full record query with tenant isolation when tenantId is provided', async () => {
      db.query.mockResolvedValue([{ id: 'draft-1', final_price: 3000, tenant_id: 'tenant-xyz' }]);

      const updateData = {
        final_price: 3000,
        gcs_storage_path: 'https://gcs/path.pdf',
        metadata: { key: 'val' },
        quotation_template_metadata_id: 'tmpl-1',
      };

      const result = await proposalDraftRepository.update('draft-1', updateData, 'tenant-xyz');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('WHERE id = $5');
      expect(sql).toContain('AND tenant_id = $6');
      expect(values[0]).toBe(3000);
      expect(values[1]).toBe('https://gcs/path.pdf');
      expect(values[4]).toBe('draft-1');
      expect(values[5]).toBe('tenant-xyz');
      expect(result).toEqual({ id: 'draft-1', final_price: 3000, tenant_id: 'tenant-xyz' });
    });
  });

  describe('softDelete', () => {
    it('executes parameterized soft delete with tenant isolation when tenantId is provided', async () => {
      db.query.mockResolvedValue([{ id: 'draft-1', is_deleted: true, tenant_id: 'tenant-xyz' }]);

      const result = await proposalDraftRepository.softDelete('draft-1', 'tenant-xyz');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('SET is_deleted = true');
      expect(sql).toContain('WHERE id = $1');
      expect(sql).toContain('AND tenant_id = $2');
      expect(values).toEqual(['draft-1', 'tenant-xyz']);
      expect(result).toEqual({ id: 'draft-1', is_deleted: true, tenant_id: 'tenant-xyz' });
    });
  });
});

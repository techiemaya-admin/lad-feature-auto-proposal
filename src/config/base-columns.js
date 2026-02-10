/**
 * Shared column definitions for all tenant-scoped tables.
 * Every table: id (UUID), tenant_id (UUID), is_deleted, metadata (JSONB), created_at, updated_at.
 */
function baseColumns() {
  return {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid',
    },
    tenant_id: {
      type: 'uuid',
      nullable: false,
    },
    is_deleted: {
      type: 'boolean',
      default: false,
    },
    metadata: {
      type: 'jsonb',
      nullable: true,
    },
    created_at: {
      type: 'timestamp',
      createDate: true,
    },
    updated_at: {
      type: 'timestamp',
      updateDate: true,
    },
  };
}

module.exports = { baseColumns };

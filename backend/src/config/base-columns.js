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
    is_deleted: {
      type: 'boolean',
      default: false,
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

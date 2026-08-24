/**
 * Shared column definitions for all tenant-scoped tables.
 * Every table: tenant_id (UUID), metadata (JSONB)
 */
function tenant_metadata_columns() {
  return {

    tenant_id: {
      type: 'uuid',
      nullable: false,
    },
    metadata: {
      type: 'jsonb',
      nullable: true,
    },
  };
}

module.exports = { tenant_metadata_columns };

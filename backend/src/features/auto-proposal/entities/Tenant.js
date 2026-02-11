const { EntitySchema } = require('typeorm');

// Tenant is root; no tenant_id (other tables reference this id as tenant_id).
module.exports = new EntitySchema({
  name: 'Tenant',
  tableName: 'tenant',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    is_deleted: { type: 'boolean', default: false },
    metadata: { type: 'jsonb', nullable: true },
    created_at: { type: 'timestamp', createDate: true },
    updated_at: { type: 'timestamp', updateDate: true },
    name: { type: 'varchar', length: 255, nullable: false },
    slug: { type: 'varchar', length: 100, nullable: true, unique: true },
  },
  relations: {
    locations: {
      type: 'one-to-many',
      target: 'Location',
      inverseSide: 'tenant',
    },
    concepts: {
      type: 'one-to-many',
      target: 'Concept',
      inverseSide: 'tenant',
    },
    pricingRules: {
      type: 'one-to-many',
      target: 'PricingRule',
      inverseSide: 'tenant',
    },
    quotations: {
      type: 'one-to-many',
      target: 'Quotation',
      inverseSide: 'tenant',
    },
  },
  indices: [
    { name: 'IDX_tenant_is_deleted', columns: ['is_deleted'] },
  ],
});

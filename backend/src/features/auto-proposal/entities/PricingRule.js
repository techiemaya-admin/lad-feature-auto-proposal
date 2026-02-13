const { EntitySchema } = require('typeorm');
const { baseColumns } = require('../../../config/base-columns');
const { tenant_metadata_columns } = require('../../../config/tenant-metadata-column');


module.exports = new EntitySchema({
  name: 'PricingRule',
  tableName: 'pricing_rules',
  columns: {
    ...baseColumns(),
    ...tenant_metadata_columns(),
    name: { type: 'varchar', length: 255, nullable: false },
    rule_type: { type: 'varchar', length: 50, nullable: false },
    parameters: { type: 'jsonb', nullable: true },
    evaluation_order: { type: 'int', default: 0 },
    is_active: { type: 'boolean', default: true },
  },
  relations: {
    tenant: {
      type: 'many-to-one',
      target: 'Tenant',
      joinColumn: { name: 'tenant_id' },
    },
  },
  indices: [
    { name: 'IDX_pricing_rules_tenant_id', columns: ['tenant_id'] },
    { name: 'IDX_pricing_rules_is_deleted', columns: ['is_deleted'] },
    { name: 'IDX_pricing_rules_evaluation_order', columns: ['evaluation_order'] },
  ],
});

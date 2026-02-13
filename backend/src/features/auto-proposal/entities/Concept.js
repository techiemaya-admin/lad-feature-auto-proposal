const { EntitySchema } = require('typeorm');
const { baseColumns } = require('../../../config/base-columns');
const { tenant_metadata_columns } = require('../../../config/tenant-metadata-column');


module.exports = new EntitySchema({
  name: 'Concept',
  tableName: 'concept',
  columns: {
    ...baseColumns(),
    ...tenant_metadata_columns(),
    name: { type: 'varchar', length: 255, nullable: false },
    marshal_ratio: { type: 'varchar', length: 255, nullable: true },
    minimum_cost: { type: 'decimal', precision: 10, scale: 2, nullable: true },
    description: { type: 'text', nullable: true },
  },
  relations: {
    tenant: {
      type: 'many-to-one',
      target: 'Tenant',
      joinColumn: { name: 'tenant_id' },
    },
    conceptLocations: {
      type: 'one-to-many',
      target: 'ConceptLocation',
      inverseSide: 'concept',
    },
    conceptPricingMatrix: {
      type: 'one-to-many',
      target: 'ConceptPricingMatrix',
      inverseSide: 'concept',
    },
  },
  indices: [
    { name: 'IDX_concept_tenant_id', columns: ['tenant_id'] },
    { name: 'IDX_concept_is_deleted', columns: ['is_deleted'] },
  ],
});

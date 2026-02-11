const { EntitySchema } = require('typeorm');
const { baseColumns } = require('../../../config/base-columns');

module.exports = new EntitySchema({
  name: 'Concept',
  tableName: 'concept',
  columns: {
    ...baseColumns(),
    name: { type: 'varchar', length: 255, nullable: false },
    code: { type: 'varchar', length: 50, nullable: true },
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

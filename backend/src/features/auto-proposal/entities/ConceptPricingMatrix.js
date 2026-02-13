const { EntitySchema } = require('typeorm');
const { baseColumns } = require('../../../config/base-columns');
const { tenant_metadata_columns } = require('../../../config/tenant-metadata-column');


module.exports = new EntitySchema({
  name: 'ConceptPricingMatrix',
  tableName: 'concept_pricing_matrix',
  columns: {
    ...baseColumns(),
    ...tenant_metadata_columns(),
    concept_id: { type: 'uuid', nullable: false },
    base_price: { type: 'decimal', precision: 14, scale: 2, nullable: false },
    min_quantity: { type: 'int', default: 1 },
    unit: { type: 'varchar', length: 50, nullable: true },
    location_multiplier: { type: 'decimal', precision: 10, scale: 4, nullable: true, default: 1 },
  },
  relations: {
    concept: {
      type: 'many-to-one',
      target: 'Concept',
      joinColumn: { name: 'concept_id' },
    },
  },
  indices: [
    { name: 'IDX_concept_pricing_matrix_tenant_id', columns: ['tenant_id'] },
    { name: 'IDX_concept_pricing_matrix_concept_id', columns: ['concept_id'] },
    { name: 'IDX_concept_pricing_matrix_is_deleted', columns: ['is_deleted'] },
  ],
});

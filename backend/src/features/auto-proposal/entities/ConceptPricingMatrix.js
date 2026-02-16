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
    location_id: { type: 'uuid', nullable: false },
    price_per_person: { type: 'decimal', precision: 14, scale: 2, nullable: false },
    min_pax: { type: 'int', default: 1 },
    max_pax: { type: 'int', default: 1 },
    markup_percentage: { type: 'decimal', precision: 14, scale: 2, nullable: false },
    discount_percentage: { type: 'decimal', precision: 14, scale: 2, nullable: false },
  },
  relations: {
    concept: {
      type: 'many-to-one',
      target: 'Concept',
      joinColumn: { name: 'concept_id' },
    },
    location: {
      type: 'many-to-one',
      target: 'Location',
      joinColumn: { name: 'location_id' },
    },
  },
  indices: [
    { name: 'IDX_concept_pricing_matrix_tenant_id', columns: ['tenant_id'] },
    { name: 'IDX_concept_pricing_matrix_concept_id', columns: ['concept_id'] },
    { name: 'IDX_concept_pricing_matrix_is_deleted', columns: ['is_deleted'] },
  ],
});

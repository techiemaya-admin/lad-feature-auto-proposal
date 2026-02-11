const { EntitySchema } = require('typeorm');
const { baseColumns } = require('../../../config/base-columns');

module.exports = new EntitySchema({
  name: 'ConceptLocation',
  tableName: 'concept_location',
  columns: {
    ...baseColumns(),
    concept_id: { type: 'uuid', nullable: false },
    location_id: { type: 'uuid', nullable: false },
    is_available: { type: 'boolean', default: true },
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
    { name: 'IDX_concept_location_tenant_id', columns: ['tenant_id'] },
    { name: 'IDX_concept_location_concept_location', columns: ['concept_id', 'location_id'] },
    { name: 'IDX_concept_location_is_deleted', columns: ['is_deleted'] },
  ],
});

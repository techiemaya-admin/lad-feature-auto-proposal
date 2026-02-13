const { EntitySchema } = require('typeorm');
const { baseColumns } = require('../../../config/base-columns');
const { tenant_metadata_columns } = require('../../../config/tenant-metadata-column');


module.exports = new EntitySchema({
  name: 'ConceptLocation',
  tableName: 'concept_location',
  columns: {
    
    concept_id: { type: 'uuid', nullable: false ,primary: true},
    location_id: { type: 'uuid', nullable: false ,primary: true}
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
    { name: 'IDX_concept_location_concept_location', columns: ['concept_id', 'location_id'] },
  ],
});

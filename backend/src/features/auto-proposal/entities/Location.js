const { EntitySchema } = require('typeorm');
const { baseColumns } = require('../../../config/base-columns');

module.exports = new EntitySchema({
  name: 'Location',
  tableName: 'location',
  columns: {
    ...baseColumns(),
    name: { type: 'varchar', length: 255, nullable: false },
    timezone: { type: 'varchar', length: 100, nullable: true },
  },
  relations: {
    conceptLocations: {
      type: 'one-to-many',
      target: 'ConceptLocation',
      inverseSide: 'location',
    },
  },
  indices: [
    { name: 'IDX_location_is_deleted', columns: ['is_deleted'] },
  ],
});

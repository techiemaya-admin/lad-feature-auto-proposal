const { EntitySchema } = require('typeorm');
const { baseColumns } = require('../../../config/base-columns');

module.exports = new EntitySchema({
  name: 'Location',
  tableName: 'location',
  columns: {
    ...baseColumns(),
    name: { type: 'varchar', length: 255, nullable: false },
    code: { type: 'varchar', length: 50, nullable: true },
    timezone: { type: 'varchar', length: 100, nullable: true },
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
      inverseSide: 'location',
    },
  },
  indices: [
    { name: 'IDX_location_tenant_id', columns: ['tenant_id'] },
    { name: 'IDX_location_is_deleted', columns: ['is_deleted'] },
  ],
});

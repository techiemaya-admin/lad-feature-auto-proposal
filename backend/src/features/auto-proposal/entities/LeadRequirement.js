const { EntitySchema } = require('typeorm');
const { baseColumns } = require('../../../config/base-columns');

module.exports = new EntitySchema({
  name: 'LeadRequirement',
  tableName: 'lead_requirement',
  columns: {
    ...baseColumns(),
    location_id: { type: 'uuid', nullable: true },
    status: { type: 'varchar', length: 50, default: 'draft' },
  },
  relations: {
    quotations: {
      type: 'one-to-many',
      target: 'Quotation',
      inverseSide: 'leadRequirement',
    },
  },
  indices: [
    { name: 'IDX_lead_requirement_tenant_id', columns: ['tenant_id'] },
    { name: 'IDX_lead_requirement_location_id', columns: ['location_id'] },
    { name: 'IDX_lead_requirement_is_deleted', columns: ['is_deleted'] },
  ],
});

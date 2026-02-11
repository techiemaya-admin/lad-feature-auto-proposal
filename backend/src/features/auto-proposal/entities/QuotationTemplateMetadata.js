const { EntitySchema } = require('typeorm');
const { baseColumns } = require('../../../config/base-columns');

module.exports = new EntitySchema({
  name: 'QuotationTemplateMetadata',
  tableName: 'quotation_template_metadata',
  columns: {
    ...baseColumns(),
    name: { type: 'varchar', length: 255, nullable: false },
    template_key: { type: 'varchar', length: 100, nullable: true },
    structure: { type: 'jsonb', nullable: true },
    is_default: { type: 'boolean', default: false },
  },
  relations: {
    quotations: {
      type: 'one-to-many',
      target: 'Quotation',
      inverseSide: 'quotationTemplateMetadata',
    },
  },
  indices: [
    { name: 'IDX_quotation_template_metadata_tenant_id', columns: ['tenant_id'] },
    { name: 'IDX_quotation_template_metadata_is_deleted', columns: ['is_deleted'] },
  ],
});

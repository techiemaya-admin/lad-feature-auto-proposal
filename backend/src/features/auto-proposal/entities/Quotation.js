const { EntitySchema } = require('typeorm');
const { baseColumns } = require('../../../config/base-columns');

module.exports = new EntitySchema({
  name: 'Quotation',
  tableName: 'quotation',
  columns: {
    ...baseColumns(),
    lead_requirement_id: { type: 'uuid', nullable: false },
    price_calculation_id: { type: 'uuid', nullable: true },
    quotation_template_metadata_id: { type: 'uuid', nullable: true },
    status: { type: 'varchar', length: 50, default: 'draft' },
    quotation_number: { type: 'varchar', length: 100, nullable: true },
    body: { type: 'jsonb', nullable: true },
  },
  relations: {
    tenant: {
      type: 'many-to-one',
      target: 'Tenant',
      joinColumn: { name: 'tenant_id' },
    },
    leadRequirement: {
      type: 'many-to-one',
      target: 'LeadRequirement',
      joinColumn: { name: 'lead_requirement_id' },
    },
    priceCalculation: {
      type: 'many-to-one',
      target: 'PriceCalculation',
      joinColumn: { name: 'price_calculation_id' },
    },
    quotationTemplateMetadata: {
      type: 'many-to-one',
      target: 'QuotationTemplateMetadata',
      joinColumn: { name: 'quotation_template_metadata_id' },
    },
  },
  indices: [
    { name: 'IDX_quotation_tenant_id', columns: ['tenant_id'] },
    { name: 'IDX_quotation_lead_requirement_id', columns: ['lead_requirement_id'] },
    { name: 'IDX_quotation_is_deleted', columns: ['is_deleted'] },
  ],
});

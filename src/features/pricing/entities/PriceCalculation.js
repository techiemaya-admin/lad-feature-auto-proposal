const { EntitySchema } = require('typeorm');
const { baseColumns } = require('../../../config/base-columns');

module.exports = new EntitySchema({
  name: 'PriceCalculation',
  tableName: 'price_calculation',
  columns: {
    ...baseColumns(),
    lead_requirement_id: { type: 'uuid', nullable: true },
    concept_id: { type: 'uuid', nullable: true },
    location_id: { type: 'uuid', nullable: true },
    base_price: { type: 'decimal', precision: 14, scale: 2, nullable: false },
    final_price: { type: 'decimal', precision: 14, scale: 2, nullable: false },
    currency: { type: 'varchar', length: 3, default: 'USD' },
    calculation_input: { type: 'jsonb', nullable: true },
    rules_applied: { type: 'jsonb', nullable: true },
  },
  relations: {
    quotations: {
      type: 'one-to-many',
      target: 'Quotation',
      inverseSide: 'priceCalculation',
    },
  },
  indices: [
    { name: 'IDX_price_calculation_tenant_id', columns: ['tenant_id'] },
    { name: 'IDX_price_calculation_lead_requirement_id', columns: ['lead_requirement_id'] },
    { name: 'IDX_price_calculation_is_deleted', columns: ['is_deleted'] },
  ],
});

function toQuotationResponse(entity) {
  if (!entity) return null;
  return {
    id: entity.id,
    tenant_id: entity.tenant_id,
    lead_requirement_id: entity.lead_requirement_id,
    price_calculation_id: entity.price_calculation_id,
    quotation_template_metadata_id: entity.quotation_template_metadata_id,
    status: entity.status,
    quotation_number: entity.quotation_number,
    body: entity.body,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}

module.exports = {
  toQuotationResponse,
};

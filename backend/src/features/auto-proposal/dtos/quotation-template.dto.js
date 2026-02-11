function createQuotationTemplateDto(body) {
  return {
    name: body.name,
    template_key: body.template_key || null,
    structure: body.structure || null,
    is_default: body.is_default === true,
  };
}

function toQuotationTemplateResponse(entity) {
  if (!entity) return null;
  return {
    id: entity.id,
    tenant_id: entity.tenant_id,
    name: entity.name,
    template_key: entity.template_key,
    structure: entity.structure,
    is_default: entity.is_default,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}

module.exports = {
  createQuotationTemplateDto,
  toQuotationTemplateResponse,
};

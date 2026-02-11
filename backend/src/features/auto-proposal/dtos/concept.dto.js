function createConceptDto(body) {
  return {
    name: body.name,
    code: body.code || null,
    description: body.description || null,
    metadata: body.metadata || null,
  };
}

function toConceptResponse(entity) {
  if (!entity) return null;
  return {
    id: entity.id,
    tenant_id: entity.tenant_id,
    name: entity.name,
    code: entity.code,
    description: entity.description,
    metadata: entity.metadata,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}

module.exports = {
  createConceptDto,
  toConceptResponse,
};

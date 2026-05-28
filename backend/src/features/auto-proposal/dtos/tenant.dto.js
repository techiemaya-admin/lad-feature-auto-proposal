function createTenantDto(body) {
  return {
    name: body.name,
    slug: body.slug || null,
    metadata: body.metadata || null,
  };
}

function toTenantResponse(entity) {
  if (!entity) return null;
  return {
    id: entity.id,
    name: entity.name,
    slug: entity.slug,
    metadata: entity.metadata,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}

module.exports = {
  createTenantDto,
  toTenantResponse,
};

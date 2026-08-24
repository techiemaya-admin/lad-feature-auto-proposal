function createLocationDto(body) {
  return {
    name: body.name,
    code: body.code || null,
    timezone: body.timezone || null,
    metadata: body.metadata || null,
  };
}

function toLocationResponse(entity) {
  if (!entity) return null;
  return {
    id: entity.id,
    tenant_id: entity.tenant_id,
    name: entity.name,
    code: entity.code,
    timezone: entity.timezone,
    metadata: entity.metadata,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}

module.exports = {
  createLocationDto,
  toLocationResponse,
};

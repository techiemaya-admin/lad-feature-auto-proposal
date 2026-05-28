function createLeadDto(body) {
  return {
    location_id: body.location_id || null,
    status: body.status || 'draft',
    metadata: body.metadata || null,
  };
}

function toLeadResponse(entity) {
  if (!entity) return null;
  return {
    id: entity.id,
    tenant_id: entity.tenant_id,
    location_id: entity.location_id,
    status: entity.status,
    metadata: entity.metadata,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}

module.exports = {
  createLeadDto,
  toLeadResponse,
};

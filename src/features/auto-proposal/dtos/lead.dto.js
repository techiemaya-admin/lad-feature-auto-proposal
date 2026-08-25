function createLeadDto(body = {}) {
  const metadata = body.metadata || null;
  const customFields = body.custom_fields || (metadata ? { ...metadata } : {});

  // Extract contact details with metadata fallback
  let firstName = body.first_name || (metadata && metadata.first_name) || null;
  let lastName = body.last_name || (metadata && metadata.last_name) || null;

  if (!firstName && !lastName && metadata && typeof metadata.customer_name === 'string') {
    const trimmed = metadata.customer_name.trim();
    const parts = trimmed.split(/\s+/);
    firstName = parts[0] || null;
    lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
  }

  const email = body.email || (metadata && metadata.email) || null;
  const phone = body.phone || (metadata && metadata.phone) || null;
  const companyName = body.company_name || (metadata && metadata.company_name) || null;

  return {
    user_id: body.user_id || null,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    company_name: companyName,
    company_domain: body.company_domain || null,
    title: body.title || null,
    linkedin_url: body.linkedin_url || null,
    location_id: body.location_id || body.location || null,
    location: body.location || body.location_id || null,
    status: body.status || 'draft',
    stage: body.stage || 'new',
    priority: body.priority !== undefined && body.priority !== null ? parseInt(body.priority, 10) || 0 : 0,
    source: body.source || null,
    source_id: body.source_id || null,
    tags: Array.isArray(body.tags) ? body.tags : [],
    custom_fields: customFields,
    metadata: metadata || customFields,
    notes: body.notes || null,
    raw_data: body.raw_data || null,
    estimated_value: body.estimated_value !== undefined && body.estimated_value !== null ? Number(body.estimated_value) : null,
    currency: body.currency || 'USD',
  };
}

function parseJsonSafely(val, fallback) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function toLeadResponse(entity) {
  if (!entity) return null;

  const customFields = parseJsonSafely(entity.custom_fields, {});
  const metadata = entity.metadata ? parseJsonSafely(entity.metadata, {}) : customFields;

  return {
    id: entity.id,
    user_id: entity.user_id || null,
    tenant_id: entity.tenant_id,
    location_id: entity.location_id || entity.location || null,
    location: entity.location || null,
    first_name: entity.first_name || null,
    last_name: entity.last_name || null,
    email: entity.email || null,
    phone: entity.phone || null,
    company_name: entity.company_name || null,
    company_domain: entity.company_domain || null,
    title: entity.title || null,
    linkedin_url: entity.linkedin_url || null,
    status: entity.status || 'active',
    stage: entity.stage || 'new',
    priority: entity.priority != null ? parseInt(entity.priority, 10) : 0,
    source: entity.source || null,
    source_id: entity.source_id || null,
    tags: parseJsonSafely(entity.tags, []),
    custom_fields: customFields,
    metadata: metadata,
    notes: entity.notes || null,
    raw_data: parseJsonSafely(entity.raw_data, null),
    estimated_value: entity.estimated_value != null ? Number(entity.estimated_value) : null,
    currency: entity.currency || 'USD',
    is_deleted: Boolean(entity.is_deleted),
    is_archived: Boolean(entity.is_archived),
    created_by_user_id: entity.created_by_user_id || null,
    assigned_user_id: entity.assigned_user_id || null,
    assigned_at: entity.assigned_at || null,
    last_contacted_at: entity.last_contacted_at || null,
    last_activity_at: entity.last_activity_at || null,
    next_follow_up_at: entity.next_follow_up_at || null,
    created_at: entity.created_at || null,
    updated_at: entity.updated_at || null,
  };
}

module.exports = {
  createLeadDto,
  toLeadResponse,
};

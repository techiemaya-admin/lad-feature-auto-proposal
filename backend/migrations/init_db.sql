
-- ============================================
-- TENANTS
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    slug varchar(100) UNIQUE,
    status varchar(50) DEFAULT 'trial',
    plan_tier varchar(50) DEFAULT 'free',
    email varchar(255),
    phone varchar(50),
    website varchar(255),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT tenants_name_not_empty CHECK (length(trim(name)) > 0)
);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL,
    password_hash varchar(255),
    first_name varchar(100),
    last_name varchar(100),
    avatar_url text,
    phone varchar(50),
    primary_tenant_id uuid,
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    phone_verified boolean DEFAULT false,
    last_login_at timestamptz,
    password_changed_at timestamptz,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz,
    FOREIGN KEY (primary_tenant_id)
        REFERENCES tenants (id)
        ON DELETE SET NULL
);

-- ============================================
-- USER IDENTITIES
-- ============================================
CREATE TABLE IF NOT EXISTS user_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    provider varchar(50) NOT NULL,
    provider_user_id varchar(255) NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamptz,
    provider_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (user_id, provider),
    FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
);

-- ============================================
-- LEADS
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    tenant_id uuid NOT NULL,
    source varchar(100),
    source_id varchar(255),
    first_name varchar(255),
    last_name varchar(255),
    email varchar(255),
    phone varchar(50),
    company_name varchar(500),
    company_domain varchar(255),
    title varchar(255),
    linkedin_url varchar(500),
    location varchar(500),
    status varchar(50) DEFAULT 'active',
    priority integer DEFAULT 0,
    stage varchar(50) DEFAULT 'new',
    tags jsonb DEFAULT '[]'::jsonb,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    notes text,
    raw_data jsonb,
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_contacted_at timestamptz,
    created_by_user_id uuid,
    assigned_user_id uuid,
    assigned_at timestamptz,
    last_activity_at timestamptz,
    next_follow_up_at timestamptz,
    estimated_value numeric(12,2),
    currency varchar(10) DEFAULT 'USD',
    is_archived boolean DEFAULT false,
    country_code varchar(10),
    base_number bigint,
    apollo_person_id varchar(100),
    phone_type varchar(20),
    phone_confidence varchar(20),
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id)
        ON DELETE CASCADE,
    FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE SET NULL
);

-- ============================================
-- CONVERSATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    lead_id uuid,
    campaign_id uuid,
    channel varchar(30) NOT NULL,
    external_thread_id varchar(255),
    status varchar(20) DEFAULT 'open',
    last_message_at timestamptz,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id)
        ON DELETE CASCADE,
    FOREIGN KEY (lead_id)
        REFERENCES leads (id)
        ON DELETE SET NULL
);

-- ============================================
-- CONVERSATION PARTICIPANTS
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    participant_type varchar(20),
    participant_id uuid,
    created_at timestamptz DEFAULT now(),
    FOREIGN KEY (conversation_id)
        REFERENCES conversations (id)
        ON DELETE CASCADE
);

-- ============================================
-- CONVERSATION MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    message_id varchar(255),
    sender_type varchar(20) NOT NULL,
    sender_id uuid,
    channel varchar(30) NOT NULL,
    message_type varchar(20),
    content text,
    raw_payload jsonb,
    ai_generated boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id)
        ON DELETE CASCADE,
    FOREIGN KEY (conversation_id)
        REFERENCES conversations (id)
        ON DELETE CASCADE
);

-- ============================================
-- LOCATION
-- ============================================
CREATE TABLE IF NOT EXISTS location (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    name varchar(255) NOT NULL,
    timezone varchar(100)
);


-- ============================================
-- PRICING MODELS
-- ===========================================
CREATE TABLE pricing_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL,        -- per_unit | hourly | fixed | package
  label VARCHAR(100),              -- Optional human-friendly label

  is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    metadata jsonb,
    tenant_id uuid NOT NULL,
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id)
);


-- ============================================
-- CONCEPT
-- ============================================
CREATE TABLE IF NOT EXISTS concept (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    tenant_id uuid NOT NULL,
    metadata jsonb,
    name varchar(255) NOT NULL,
    minimum_cost numeric(10,2),
    description text,
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id)

);

CREATE TABLE lead_requirement_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid NOT NULL,

    field_key varchar(100) NOT NULL,   -- "main_event"
    label varchar(255),                -- "Main Event"

    is_required boolean DEFAULT false,
    is_active boolean DEFAULT true,
    
    base_price numeric(10,2) NOT NULL,
    pricing_model_id UUID,
    FOREIGN KEY (pricing_model_id) REFERENCES pricing_models (id),

    created_at timestamptz DEFAULT now()
);




-- ============================================
-- MAPPING: CONCEPT <-> LEAD_REQUIREMENT_CONFIG
-- ============================================
CREATE TABLE IF NOT EXISTS concept_requirement_config_mapping (
    concept_id uuid NOT NULL,
    requirement_config_id uuid NOT NULL,

    -- Foreign Keys
    FOREIGN KEY (concept_id) 
        REFERENCES concept (id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_config_id) 
        REFERENCES lead_requirement_config (id) ON DELETE CASCADE,

    -- Composite Primary Key (Prevents duplicate pairs and creates a natural index)
    PRIMARY KEY (concept_id, requirement_config_id)
);

-- ============================================
-- QUOTATION TEMPLATE METADATA
-- ============================================
CREATE TABLE IF NOT EXISTS quotation_template_metadata (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    tenant_id uuid NOT NULL,
    concept_id uuid NOT NULL,
    metadata jsonb,
    name varchar(255) NOT NULL,
    type varchar(100),
    storage_path varchar(255),
    is_default boolean DEFAULT false,
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id),
    FOREIGN KEY (concept_id)
        REFERENCES concept (id)
);


-- ============================================
-- LEAD REQUIREMENT
-- ============================================
CREATE TABLE IF NOT EXISTS lead_requirement (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    tenant_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    metadata jsonb,
    location  varchar(255),
    event_type varchar(255),
    duration decimal(5,2),
    event_category varchar(255),
    services_requested jsonb,
    client_type varchar(255),
    inquiry_type varchar(255),
    support_level varchar(255),
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id),
    FOREIGN KEY (lead_id)
        REFERENCES leads (id)
);




-- ============================================
-- LEAD ATTACHMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS lead_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    quotation_template_metadata_id uuid,
    file_url text NOT NULL,
    file_name varchar(255),
    file_type varchar(100),
    file_size bigint,
    uploaded_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    is_deleted boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    FOREIGN KEY (tenant_id, lead_id)
        REFERENCES leads (tenant_id, id)
        ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by)
        REFERENCES users (id)
        ON DELETE SET NULL,
    
    FOREIGN KEY (quotation_template_metadata_id)
        REFERENCES quotation_template_metadata (id)
        ON DELETE SET NULL
);

-- ============================================
-- TABLE: PRICING_RULES (Updated for Service/Package logic)
-- ============================================
CREATE TABLE IF NOT EXISTS pricing_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    
    -- UI Logic: 'service' (Radio: Services) vs 'package' (Radio: Package)
    target_type VARCHAR(20) NOT NULL DEFAULT 'service' CHECK (target_type IN ('service', 'package')),
    
    -- Relationships (Both optional depending on target_type)
    concept_id uuid,               -- Selected when target_type is 'package'
    requirement_config_id uuid,    -- Selected when target_type is 'service'
    
    name VARCHAR(100) NOT NULL,
    priority INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,

    -- Condition Logic (e.g., Guest Count > 100)
    condition_field VARCHAR(50), 
    condition_operator VARCHAR(10),
    condition_value NUMERIC(10,2),

    -- Action Logic (e.g., Discount Subtract 500)
    action_type VARCHAR(20),       -- e.g., 'discount', 'surcharge'
    action_mode VARCHAR(20),       -- e.g., 'subtract', 'add', 'set'
    action_value NUMERIC(10,2),
    action_value_type VARCHAR(20), -- e.g., 'fixed', 'percentage'

    -- Audit & Metadata
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants (id),
    FOREIGN KEY (concept_id) REFERENCES concept (id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_config_id) REFERENCES lead_requirement_config (id) ON DELETE CASCADE
);

-- Indexing for fast calculation lookups
CREATE INDEX idx_pricing_rules_tenant_target ON pricing_rules(tenant_id, target_type, is_active);

-- ============================================
-- PROPOSAL DRAFT
-- ============================================

CREATE TABLE IF NOT EXISTS proposal_draft (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    tenant_id uuid NOT NULL,
    lead_requirement_id uuid,
    final_price numeric(14,2) NOT NULL,
    gcs_storage_path varchar(1500) NOT NULL,
    file_name varchar(255) NOT NULL,
    calculation_snapshot JSONB NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'DRAFTED',

    metadata jsonb,
    quotation_template_metadata_id uuid,
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id),

    FOREIGN KEY (lead_requirement_id)
        REFERENCES lead_requirement (id),

    FOREIGN KEY (quotation_template_metadata_id)
        REFERENCES quotation_template_metadata (id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS proposal_draft_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_draft_id uuid REFERENCES proposal_draft(id) ON DELETE CASCADE,
    concept_name text NOT NULL, -- 'LITE' or 'IMPACT'
    label text NOT NULL,        -- 'Catering'
    unit_count int NOT NULL,
    total_price decimal(12, 2) NOT NULL,
    applied_rules jsonb,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    tenant_id uuid NOT NULL,
    metadata jsonb,
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id),
    FOREIGN KEY (proposal_draft_id)
        REFERENCES proposal_draft (id)
        ON DELETE CASCADE
);

CREATE TABLE gmail_watch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_identities_id UUID NOT NULL UNIQUE,

    history_id VARCHAR(255),
    expiration VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_identity
        FOREIGN KEY (user_identities_id)
        REFERENCES user_identities(id)
        ON DELETE CASCADE,
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id)

);

-- lead_requirement
--     ↓
-- lead_requirement_config   (what fields exist)
--     ↓
-- lead_requirement_values   (actual data)



CREATE TABLE lead_requirement_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    lead_requirement_id uuid NOT NULL,
    field_id uuid NOT NULL,

    value_text text,
    value_number decimal,
    value_json jsonb,

    created_at timestamptz DEFAULT now(),

    FOREIGN KEY (lead_requirement_id)
        REFERENCES lead_requirement (id),

    FOREIGN KEY (field_id)
        REFERENCES lead_requirement_config (id)
);


ALTER TABLE lead_requirement_values 
ADD CONSTRAINT unique_lead_req_field 
UNIQUE (lead_requirement_id, field_id);

ALTER TABLE conversations ADD CONSTRAINT unique_external_thread_id UNIQUE (external_thread_id);


ALTER TABLE conversation_participants
ADD CONSTRAINT unique_conversation_participant
UNIQUE (conversation_id, participant_id);


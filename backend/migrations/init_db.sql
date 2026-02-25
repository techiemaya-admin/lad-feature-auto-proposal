
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
    marshal_ratio varchar(255),
    minimum_cost numeric(10,2),
    description text,
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id)
);

-- ============================================
-- CONCEPT LOCATION (M2M)
-- ============================================
CREATE TABLE IF NOT EXISTS concept_location (
    concept_id uuid NOT NULL,
    location_id uuid NOT NULL,
    PRIMARY KEY (concept_id, location_id),
    FOREIGN KEY (concept_id)
        REFERENCES concept (id)
        ON DELETE CASCADE,
    FOREIGN KEY (location_id)
        REFERENCES location (id)
        ON DELETE CASCADE
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
    pax integer NOT NULL,
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id),
    FOREIGN KEY (lead_id)
        REFERENCES leads (id)
);

-- ============================================
-- CONCEPT PRICING MATRIX
-- ============================================
CREATE TABLE IF NOT EXISTS concept_pricing_matrix (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    tenant_id uuid NOT NULL,
    metadata jsonb,
    concept_id uuid NOT NULL,
    price_per_person numeric(14,2) NOT NULL,
    min_pax integer DEFAULT 1,
    max_pax integer DEFAULT 1,
    discount_percentage numeric(14,2) NOT NULL,
    markup_percentage numeric(14,2) NOT NULL,
    location_id uuid NOT NULL,
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id),
    FOREIGN KEY (concept_id)
        REFERENCES concept (id),
    FOREIGN KEY (location_id)
        REFERENCES location (id)
);

-- ============================================
-- PRICE CALCULATION
-- ============================================
CREATE TABLE IF NOT EXISTS price_calculation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    tenant_id uuid NOT NULL,
    metadata jsonb,
    lead_requirement_id uuid,
    concept_pricing_matrix_id uuid,
    base_price numeric(14,2) NOT NULL,
    markup_price numeric(14,2) NOT NULL,
    discount_price numeric(14,2) NOT NULL,
    is_minimum_cost_applied boolean DEFAULT false,
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id),
    FOREIGN KEY (lead_requirement_id)
        REFERENCES lead_requirement (id),
    FOREIGN KEY (concept_pricing_matrix_id)
        REFERENCES concept_pricing_matrix (id)
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
-- LEAD ATTACHMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS lead_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    price_calculation_id uuid,
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
    FOREIGN KEY (price_calculation_id)
        REFERENCES price_calculation (id)
        ON DELETE SET NULL,
    FOREIGN KEY (quotation_template_metadata_id)
        REFERENCES quotation_template_metadata (id)
        ON DELETE SET NULL
);

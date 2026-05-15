
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
    tenant_id uuid NOT NULL,
    name varchar(255) NOT NULL,
    type varchar(100), 
    storage_path varchar(1500),
    is_default boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    metadata jsonb,
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id)
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

CREATE TABLE IF NOT EXISTS quotation_placeholders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    placeholder_key varchar(100) NOT NULL, -- e.g., 'lead_name'
    display_name varchar(255) NOT NULL,    -- e.g., 'Lead Name'
    description text,                      -- e.g., 'The full name of the lead'
    category varchar(50),                  -- e.g., 'Client', 'Pricing', 'Company'
    data_source_path varchar(255),         -- e.g., 'lead.full_name' or 'pricing.final_price'
    is_loop boolean DEFAULT false,          -- True for arrays like 'breakdown'
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    metadata jsonb,
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (id)
);

ALTER TABLE lead_requirement_values 
ADD CONSTRAINT unique_lead_req_field 
UNIQUE (lead_requirement_id, field_id);

ALTER TABLE conversations ADD CONSTRAINT unique_external_thread_id UNIQUE (external_thread_id);


ALTER TABLE conversation_participants
ADD CONSTRAINT unique_conversation_participant
UNIQUE (conversation_id, participant_id);

-- ============================================
-- tenant_profile_details
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_profile_details (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL UNIQUE,
    company_logo_url text, -- URL to GCS or external logo
    whatsapp_url text,
    linkedin_url text,
    instagram_url text,
    website_url text,
    official_email text,
    tagline text,
    is_deleted boolean DEFAULT false,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
);

CREATE TABLE IF NOT EXISTS email_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    template_name varchar(255) NOT NULL, -- e.g., 'Proposal Delivery'
    subject_line varchar(255),            -- e.g., 'Your Quotation from {{companyname}}'
    storage_path text NOT NULL,           -- GCS path to the .html or .txt file
    relative_path varchar(1500) NOT NULL,     -- Relative path for easy retrieval
    is_default boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
);



CREATE TABLE quotation_email_template (
    -- Primary Identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL, -- e.g., "Follow-up Quotation"
    tenant_id uuid NOT NULL,
	is_default boolean DEFAULT FALSE,
    -- Content
    subject TEXT NOT NULL, -- Email subject line[cite: 1]
    body_text TEXT, -- The actual plain text message[cite: 1]
    content_format VARCHAR(20) DEFAULT 'plain_text', -- 'plain_text' or 'html'[cite: 1]
    body_html TEXT,
    -- Metadata for AI & Filtering
    description TEXT, -- Internal notes[cite: 1]
    media_url TEXT,
    media_alt_text TEXT,
	
    is_deleted boolean DEFAULT false,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
);

ALTER TABLE conversation_messages
ADD COLUMN global_message_id varchar(1000);



INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    avatar_url,
    phone,
    primary_tenant_id,
    is_active,
    email_verified,
    phone_verified,
    last_login_at,
    password_changed_at,
    metadata,
    created_at,
    updated_at,
    deleted_at
) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'abc@gmail.com',
    '$2b$10$dummyhashedpassword123456789',
    'Shweta',
    'Goel',
    'https://randomuser.me/api/portraits/women/1.jpg',
    '+91-9876543210',
    NULL,
    true,
    true,
    false,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '10 days',
    '{"role": "admin"}'::jsonb,
    NOW(),
    NOW(),
    NULL
),
(
    gen_random_uuid(),
    'rahul.sharma@example.com',
    '$2b$10$dummyhashedpassword987654321',
    'Rahul',
    'Sharma',
    'https://randomuser.me/api/portraits/men/2.jpg',
    '+91-9123456780',
    NULL,
    true,
    true,
    true,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '5 days',
    '{"role": "user"}'::jsonb,
    NOW(),
    NOW(),
    NULL
),
(
    gen_random_uuid(),
    'priya.verma@example.com',
    '$2b$10$dummyhashedpassword456789123',
    'Priya',
    'Verma',
    'https://randomuser.me/api/portraits/women/3.jpg',
    '+91-9988776655',
    NULL,
    true,
    false,
    false,
    NULL,
    NOW() - INTERVAL '20 days',
    '{"role": "manager"}'::jsonb,
    NOW(),
    NOW(),
    NULL
);





INSERT INTO public.tenants (id, name, slug, status, plan_tier, email, phone, website, metadata)
VALUES
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'Alpha Corp', 'alpha-corp', 'trial', 'free', 'contact@alphacorp.com', '+1-555-0101', 'https://alphacorp.com', '{}'),
('550e8400-e29b-41d4-a716-446655440002', 'Beta Solutions', 'beta-solutions', 'active', 'pro', 'hello@betasolutions.com', '+1-555-0202', 'https://betasolutions.com', '{}'),
('550e8400-e29b-41d4-a716-446655440003', 'Gamma Industries', 'gamma-industries', 'active', 'enterprise', 'info@gammaindustries.com', '+1-555-0303', 'https://gammaindustries.com', '{}');


INSERT INTO pricing_models (id, type, tenant_id, label, metadata)
VALUES
(gen_random_uuid(), 'per_person', 'e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'Per Person Pricing', '{"label":"Per Person Pricing"}'),

(gen_random_uuid(), 'per_hour', 'e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'Hourly Pricing', '{"label":"Hourly Pricing"}'),

(gen_random_uuid(), 'fixed', 'e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'Fixed Pricing', '{"label":"Fixed Pricing"}'),

(gen_random_uuid(), 'per_kg', 'e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'Weight Based Pricing', '{"label":"Weight Based Pricing"}'),

(gen_random_uuid(), 'per_month', 'e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'Monthly Based Pricing', '{"label":"Monthly Based Pricing"}');







INSERT INTO quotation_placeholders (
    tenant_id,
    placeholder_key,
    display_name,
    description,
    category,
    data_source_path,
    is_loop,
    metadata
)
VALUES
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'date', 'Date', 'Date when quotation/email is generated', 'Date', 'date', false, '{"type": "date", "format": "YYYY-MM-DD"}'::jsonb),
-- ================= CLIENT =================
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'lead_name', 'Lead Name', 'Full name of the client', 'Client', 'lead_name', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'lead_email', 'Lead Email', 'Email of the client', 'Client', 'lead_email', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'lead_phone', 'Lead Phone', 'Phone number of the client', 'Client', 'lead_phone', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'lead_company', 'Client Company', 'Company name of the client', 'Client', 'lead_company', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'lead_address', 'Client Address', 'Address of the client', 'Client', 'lead_address', false, '{}'::jsonb),

-- ================= COMPANY =================
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'company_name', 'Company Name', 'Your company name', 'Company', 'company_name', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'company_email', 'Company Email', 'Company email address', 'Company', 'company_email', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'company_phone', 'Company Phone', 'Company phone number', 'Company', 'company_phone', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'company_address', 'Company Address', 'Company address', 'Company', 'company_address', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'company_website', 'Company Website', 'Company website', 'Company', 'company_website', false, '{}'::jsonb),

-- ================= BRANDING =================
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'company_logo', 'Company Logo', 'Company logo image URL or base64', 'Branding', 'company_logo', false, '{"type": "image"}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'company_tagline', 'Company Tagline', 'Short tagline of company', 'Branding', 'company_tagline', false, '{}'::jsonb),

-- ================= SOCIAL =================
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'instagram_url', 'Instagram', 'Instagram profile link', 'Social', 'instagram_url', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'linkedin_url', 'LinkedIn', 'LinkedIn profile link', 'Social', 'linkedin_url', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'facebook_url', 'Facebook', 'Facebook page link', 'Social', 'facebook_url', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'whatsapp_url', 'Whatsapp', 'Whatsapp link', 'Social', 'whatsapp_url', false, '{}'::jsonb),

-- ================= QUOTATION =================
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'quotation_id', 'Quotation ID', 'Unique quotation ID', 'Quotation', 'quotation_id', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'quotation_date', 'Quotation Date', 'Date of quotation', 'Quotation', 'quotation_date', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'valid_till', 'Valid Till', 'Quotation expiry date', 'Quotation', 'valid_till', false, '{}'::jsonb),

-- ================= PRICING =================
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'total_base_price', 'Total Base Price', 'Base price before adjustments', 'Pricing', 'total_base_price', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'total_discount', 'Total Discount', 'Total discount applied', 'Pricing', 'total_discount', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'total_surcharge', 'Total Surcharge', 'Additional charges like tax/fees', 'Pricing', 'total_surcharge', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'final_price', 'Final Price', 'Final payable amount', 'Pricing', 'final_price', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'currency', 'Currency', 'Currency used', 'Pricing', 'currency', false, '{"symbol": "₹"}'::jsonb),

-- ================= LINE ITEMS =================
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'items', 'Items List', 'List of items/services', 'LineItems', 'items', true, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'item_name', 'Item Name', 'Name of item', 'LineItems', 'item_name', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'item_description', 'Item Description', 'Description of item', 'LineItems', 'item_description', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'item_quantity', 'Quantity', 'Quantity of item', 'LineItems', 'item_quantity', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'item_price', 'Item Price', 'Price per item', 'LineItems', 'item_price', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'item_total', 'Item Total', 'Total for item', 'LineItems', 'item_total', false, '{}'::jsonb),

-- ================= EXTRA =================
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'notes', 'Notes', 'Additional notes', 'Extra', 'notes', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'terms_conditions', 'Terms & Conditions', 'Terms and conditions', 'Extra', 'terms_conditions', false, '{}'::jsonb),
('e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5', 'prepared_by', 'Prepared By', 'Prepared by user name', 'Extra', 'prepared_by', false, '{}'::jsonb);


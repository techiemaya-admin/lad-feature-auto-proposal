const { createLeadDto, toLeadResponse } = require('../lead.dto');

describe('Lead DTO', () => {
  describe('createLeadDto', () => {
    it('retains all valid lead properties from request body', () => {
      const input = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        company_name: 'Acme Corp',
        company_domain: 'acme.com',
        title: 'VP Engineering',
        linkedin_url: 'https://linkedin.com/in/johndoe',
        location_id: 'loc-123',
        status: 'active',
        stage: 'qualified',
        priority: 2,
        source: 'inbound',
        source_id: 'src-999',
        tags: ['enterprise', 'high-priority'],
        custom_fields: { budget: 50000, timeline: 'Q3' },
        metadata: { campaign: 'summer2026' },
        notes: 'Interested in enterprise tier',
        raw_data: { raw: 'payload' },
        estimated_value: 50000,
        currency: 'USD',
      };

      const dto = createLeadDto(input);

      expect(dto.first_name).toBe('John');
      expect(dto.last_name).toBe('Doe');
      expect(dto.email).toBe('john.doe@example.com');
      expect(dto.phone).toBe('+1234567890');
      expect(dto.company_name).toBe('Acme Corp');
      expect(dto.company_domain).toBe('acme.com');
      expect(dto.title).toBe('VP Engineering');
      expect(dto.linkedin_url).toBe('https://linkedin.com/in/johndoe');
      expect(dto.location_id).toBe('loc-123');
      expect(dto.status).toBe('active');
      expect(dto.stage).toBe('qualified');
      expect(dto.priority).toBe(2);
      expect(dto.source).toBe('inbound');
      expect(dto.source_id).toBe('src-999');
      expect(dto.tags).toEqual(['enterprise', 'high-priority']);
      expect(dto.custom_fields).toEqual({ budget: 50000, timeline: 'Q3' });
      expect(dto.metadata).toEqual({ campaign: 'summer2026' });
      expect(dto.notes).toBe('Interested in enterprise tier');
      expect(dto.raw_data).toEqual({ raw: 'payload' });
      expect(dto.estimated_value).toBe(50000);
      expect(dto.currency).toBe('USD');
    });

    it('extracts contact details from metadata fallback when top-level fields are missing', () => {
      const input = {
        location_id: 'loc-123',
        status: 'draft',
        metadata: {
          customer_name: 'Jane Smith',
          email: 'jane.smith@example.com',
          phone: '+9876543210',
          company_name: 'Beta LLC',
        },
      };

      const dto = createLeadDto(input);

      expect(dto.email).toBe('jane.smith@example.com');
      expect(dto.phone).toBe('+9876543210');
      expect(dto.first_name).toBe('Jane');
      expect(dto.last_name).toBe('Smith');
      expect(dto.company_name).toBe('Beta LLC');
      expect(dto.location_id).toBe('loc-123');
      expect(dto.metadata).toEqual(input.metadata);
    });

    it('handles empty or missing body gracefully with defaults', () => {
      const dto = createLeadDto({});

      expect(dto.email).toBeNull();
      expect(dto.phone).toBeNull();
      expect(dto.first_name).toBeNull();
      expect(dto.last_name).toBeNull();
      expect(dto.tags).toEqual([]);
      expect(dto.custom_fields).toEqual({});
      expect(dto.status).toBe('draft');
      expect(dto.stage).toBe('new');
      expect(dto.priority).toBe(0);
      expect(dto.currency).toBe('USD');
    });
  });

  describe('toLeadResponse', () => {
    it('returns null when entity is falsy', () => {
      expect(toLeadResponse(null)).toBeNull();
      expect(toLeadResponse(undefined)).toBeNull();
    });

    it('formats complete lead entity including contact details, timestamps, and json fields', () => {
      const entity = {
        id: 'lead-123',
        user_id: 'user-456',
        tenant_id: 'tenant-789',
        location: 'loc-001',
        location_id: 'loc-001',
        first_name: 'Alice',
        last_name: 'Johnson',
        email: 'alice@example.com',
        phone: '+1122334455',
        company_name: 'Tech Innovators',
        company_domain: 'techinnovators.io',
        title: 'CTO',
        linkedin_url: 'https://linkedin.com/in/alice',
        status: 'active',
        stage: 'proposal',
        priority: 1,
        source: 'web',
        source_id: 'src-1',
        tags: '["saas", "vip"]',
        custom_fields: '{"seats": 20}',
        notes: 'Key prospect',
        raw_data: '{"extra": true}',
        estimated_value: 12000.5,
        currency: 'USD',
        is_deleted: false,
        is_archived: false,
        created_by_user_id: 'user-456',
        assigned_user_id: 'user-789',
        assigned_at: '2026-08-25T10:00:00.000Z',
        last_contacted_at: '2026-08-25T11:00:00.000Z',
        last_activity_at: '2026-08-25T11:30:00.000Z',
        next_follow_up_at: '2026-08-28T09:00:00.000Z',
        created_at: '2026-08-25T09:00:00.000Z',
        updated_at: '2026-08-25T11:30:00.000Z',
      };

      const response = toLeadResponse(entity);

      expect(response).toEqual({
        id: 'lead-123',
        user_id: 'user-456',
        tenant_id: 'tenant-789',
        location_id: 'loc-001',
        location: 'loc-001',
        first_name: 'Alice',
        last_name: 'Johnson',
        email: 'alice@example.com',
        phone: '+1122334455',
        company_name: 'Tech Innovators',
        company_domain: 'techinnovators.io',
        title: 'CTO',
        linkedin_url: 'https://linkedin.com/in/alice',
        status: 'active',
        stage: 'proposal',
        priority: 1,
        source: 'web',
        source_id: 'src-1',
        tags: ['saas', 'vip'],
        custom_fields: { seats: 20 },
        metadata: { seats: 20 },
        notes: 'Key prospect',
        raw_data: { extra: true },
        estimated_value: 12000.5,
        currency: 'USD',
        is_deleted: false,
        is_archived: false,
        created_by_user_id: 'user-456',
        assigned_user_id: 'user-789',
        assigned_at: '2026-08-25T10:00:00.000Z',
        last_contacted_at: '2026-08-25T11:00:00.000Z',
        last_activity_at: '2026-08-25T11:30:00.000Z',
        next_follow_up_at: '2026-08-28T09:00:00.000Z',
        created_at: '2026-08-25T09:00:00.000Z',
        updated_at: '2026-08-25T11:30:00.000Z',
      });
    });
  });
});

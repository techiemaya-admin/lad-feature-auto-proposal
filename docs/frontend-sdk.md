# Frontend SDK-First Architecture Guidelines

Integration specifications for frontend web clients consuming the `lad-feature-auto-proposal` backend API.

---

## 1. SDK-First Pattern

All business logic, API communication, authentication handling, and state caching live within an `@app/sdk` package. The web layer (`web/`) is a thin rendering surface consuming React Query hooks exported by the SDK.

```
Web Layer (UI Rendering)
   │
   ▼
SDK Layer (@app/sdk)
   ├── Feature Hooks (React Query)
   ├── Typed API Clients (Axios / Fetch)
   ├── Auth & Tenant Context Interceptor (X-Tenant-Id)
   └── TypeScript DTO Contracts
   │
   ▼
Backend API (Express + PostgreSQL)
```

---

## 2. Layer Separation Rules

1. **Web Layer Never Calls Backend Directly:** UI components must never execute raw `fetch()` or `axios()` calls.
2. **SDK Enforces Multi-Tenancy:** The SDK layer automatically intercepts requests and attaches the `X-Tenant-Id` header (and JWT `Authorization` header).
3. **Smart Pages vs. Dumb Components:**
   - **Page Components:** Invoke SDK hooks (e.g., `useConcepts()`, `useCreateProposal()`) and manage navigation.
   - **Dumb Components:** Receive props and callback functions; render pure JSX.

---

## 3. Standard SDK Feature Module Structure

Each backend feature maps to an SDK feature folder:

```
sdk/features/concept/
├── api.ts          # Pure HTTP client methods
├── types.ts        # TypeScript interfaces matching backend DTOs
├── hooks.ts        # React Query query & mutation hooks
└── index.ts        # Public module exports
```

### Example Implementation

#### `types.ts`
```typescript
export interface Concept {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateConceptDTO {
  name: string;
  code?: string;
  description?: string;
}
```

#### `api.ts`
```typescript
import { apiClient } from '@/sdk/core/api-client';
import { Concept, CreateConceptDTO } from './types';

export const conceptApi = {
  list: (tenantId: string) => apiClient.get<Concept[]>(`/api/concepts/${tenantId}`),
  create: (data: CreateConceptDTO) => apiClient.post<Concept>('/api/concepts', data),
  update: (id: string, data: Partial<CreateConceptDTO>) => apiClient.put<Concept>(`/api/concepts/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/concepts/${id}`),
};
```

#### `hooks.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conceptApi } from './api';
import { CreateConceptDTO } from './types';

export const useConcepts = (tenantId: string) => {
  return useQuery({
    queryKey: ['concepts', tenantId],
    queryFn: () => conceptApi.list(tenantId),
  });
};

export const useCreateConcept = (tenantId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateConceptDTO) => conceptApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concepts', tenantId] });
    },
  });
};
```

---

## 4. Key Endpoints Mapped to SDK Modules

| SDK Feature Module | Backend Endpoints | Purpose |
|--------------------|-------------------|---------|
| `tenant` | `/api/tenants/*` | Tenant management & profile |
| `location` | `/api/locations/*` | Multi-location management |
| `concept` | `/api/concepts/*`, `/api/concept-pricing-matrix/*` | Product catalog & pricing matrices |
| `lead` | `/api/leads/*`, `/api/lead-requirement-config/*` | Inquiries & dynamic requirement schemas |
| `pricing` | `/api/pricing-models/*`, `/api/pricing-rules/*` | Dynamic pricing models & rules |
| `proposal` | `/api/quotations/*`, `/api/proposal-draft/*` | Quote generation & draft approvals |
| `template` | `/api/quotation-templates/*`, `/api/template-placeholder/*` | Document & email templates |
| `conversation` | `/api/email-conversations/*`, `/api/social-integration/*` | Threads, message upload & AI crux summaries |
| `ai` | `/api/ai-response/*` | Intelligent concept & pricing suggestions |

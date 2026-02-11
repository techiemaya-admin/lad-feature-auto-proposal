# Frontend - LAD SDK-First Architecture

## Overview
The frontend follows a **SDK-First** pattern where all business logic and API calls live in the SDK layer. The web layer only consumes SDK hooks and renders UI.

## Folder Structure

```
frontend/
├── sdk/                     # SDK Layer - THE ONLY PLACE FOR BUSINESS LOGIC & API CALLS
│   ├── features/           # Feature modules (mirrors backend structure)
│   │   ├── concept/
│   │   │   ├── api.ts          # HTTP calls to /api/concepts/* endpoints ONLY
│   │   │   ├── types.ts        # TypeScript interfaces/contracts
│   │   │   ├── hooks.ts        # React Query hooks (useQuery, useMutation)
│   │   │   ├── index.ts        # Public API exports
│   │   │   └── README.md
│   │   │
│   │   ├── lead/
│   │   │   ├── api.ts          # HTTP calls to /api/leads/* endpoints
│   │   │   ├── types.ts        # Lead interfaces
│   │   │   ├── hooks.ts        # useLeads, useCreateLead, etc.
│   │   │   ├── index.ts
│   │   │   └── README.md
│   │   │
│   │   ├── location/       # Location feature SDK
│   │   ├── pricing/        # Pricing feature SDK
│   │   ├── quotation/      # Quotation feature SDK
│   │   ├── quotation-template/  # Template feature SDK
│   │   └── tenant/         # Tenant management SDK
│   │
│   ├── core/               # Shared SDK infrastructure
│   │   ├── api-client.ts       # HTTP client setup (axios, fetch wrappers)
│   │   ├── auth.ts             # Authentication & JWT handling
│   │   ├── tenant.ts           # Tenant context management
│   │   ├── error-handler.ts    # API error parsing
│   │   ├── types.ts            # Global TypeScript types
│   │   └── README.md
│   │
│   ├── hooks/              # Global React hooks
│   │   ├── useAuth.ts          # Authentication hook
│   │   ├── useTenant.ts        # Tenant context hook
│   │   ├── useApi.ts           # API communication setup
│   │   └── README.md
│   │
│   ├── utils/              # Global utilities
│   │   ├── formatters.ts       # Date, number, text formatting
│   │   ├── validators.ts       # Input validation
│   │   └── README.md
│   │
│   ├── package.json        # SDK package definition
│   └── README.md
│
├── web/                    # Web Layer - UI ONLY (thin rendering layer)
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── components/     # UI components (no API calls)
│   │   │   ├── common/         # Reusable UI components (Button, Modal, etc.)
│   │   │   ├── concept/        # Concept feature UI components
│   │   │   ├── lead/           # Lead feature UI components
│   │   │   ├── location/       # Location feature UI components
│   │   │   ├── pricing/        # Pricing feature UI components
│   │   │   ├── quotation/      # Quotation feature UI components
│   │   │   └── layout/         # Layout components (Header, Sidebar, etc.)
│   │   │
│   │   ├── pages/          # Page components
│   │   │   ├── concept/        # Concept listing, detail pages
│   │   │   ├── lead/           # Lead management pages
│   │   │   ├── pricing/        # Pricing pages
│   │   │   ├── quotation/      # Quotation pages
│   │   │   ├── dashboard.tsx   # Landing page
│   │   │   └── 404.tsx
│   │   │
│   │   ├── hooks/          # Application-specific React hooks
│   │   │   └── useFeature.ts   # Custom hooks using SDK hooks
│   │   │
│   │   ├── context/        # React Context (minimal - prefer hooks)
│   │   ├── utils/          # Web-layer utilities (formatting, etc.)
│   │   ├── App.tsx         # Main App component
│   │   └── index.tsx       # Entry point
│   │
│   ├── package.json        # Web app dependencies
│   └── README.md
│
├── .env.example            # Example environment variables
└── README.md               # This file
```

## Architecture Principles

### 1. **SDK-First Pattern**
ALL business logic, API calls, and data fetching lives in `sdk/`.
The `web/` layer ONLY consumes SDK hooks and renders UI.

✅ **Correct Pattern:**
```typescript
// In sdk/features/concept/hooks.ts
export const useConcepts = () => {
  return useQuery('concepts', () => conceptApi.list());
};

// In web/pages/concept/List.tsx
import { useConcepts } from '@/sdk/features/concept';
const { data, isLoading } = useConcepts();
return <div>{data?.map(c => <ConceptCard key={c.id} concept={c} />)}</div>;
```

❌ **Wrong Pattern (DO NOT DO):**
```typescript
// web/pages/concept/List.tsx directly calling API
const List = () => {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch('/api/concepts').then(r => r.json()).then(setData); // ❌ NO!
  }, []);
};
```

### 2. **Layer Separation**
- **SDK (`sdk/`):** Business logic, API calls, data management
- **Web (`web/`):** UI components, layouts, page rendering
- **Core (`sdk/core/`):** Shared infrastructure
- **Web never calls the backend directly**

### 3. **Component Guidelines**

**Web Components (Dumb Components):**
- Accept data via props
- Fire event handlers for user actions
- Call SDK hooks to trigger mutations
- Focus on rendering only

**Example:**
```typescript
// web/components/concept/ConceptForm.tsx
interface Props {
  initialData?: Concept;
  onSave: (data: Concept) => void;
  isLoading: boolean;
}

export const ConceptForm: React.FC<Props> = ({ initialData, onSave, isLoading }) => {
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSave(formData);
    }}>
      {/* render form */}
    </form>
  );
};
```

**Page Components (Smart Components):**
- Use SDK hooks for data fetching
- Compose UI components
- Handle routing and navigation

**Example:**
```typescript
// web/pages/concept/Edit.tsx
import { useConcept, useUpdateConcept } from '@/sdk/features/concept';
import { ConceptForm } from '@/components/concept/ConceptForm';

export const EditConceptPage = ({ id }) => {
  const { data, isLoading } = useConcept(id);
  const { mutate: update, isLoading: isSaving } = useUpdateConcept();

  return (
    <ConceptForm 
      initialData={data} 
      onSave={update}
      isLoading={isSaving}
    />
  );
};
```

### 4. **API Module Pattern (SDK)**

Each feature SDK follows this pattern:

**api.ts** - HTTP calls only:
```typescript
import { apiClient } from '@/sdk/core/api-client';

export const conceptApi = {
  list: () => apiClient.get('/concepts'),
  get: (id: string) => apiClient.get(`/concepts/${id}`),
  create: (data: CreateConceptDTO) => apiClient.post('/concepts', data),
  update: (id: string, data: UpdateConceptDTO) => apiClient.put(`/concepts/${id}`, data),
  delete: (id: string) => apiClient.delete(`/concepts/${id}`),
};
```

**types.ts** - Interfaces:
```typescript
export interface Concept {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateConceptDTO {
  name: string;
  code: string;
  description?: string;
}
```

**hooks.ts** - React Query hooks:
```typescript
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { conceptApi } from './api';

export const useConcepts = () => {
  return useQuery('concepts', conceptApi.list);
};

export const useConcept = (id: string) => {
  return useQuery(['concept', id], () => conceptApi.get(id));
};

export const useCreateConcept = () => {
  const qc = useQueryClient();
  return useMutation(conceptApi.create, {
    onSuccess: () => qc.invalidateQueries('concepts'),
  });
};
```

**index.ts** - Public exports:
```typescript
export * from './types';
export * from './hooks';
export { conceptApi } from './api';
```

### 5. **Multi-Tenancy in Frontend**
- Tenant ID comes from JWT (decoded in `sdk/core/auth.ts`)
- Passed automatically in all API calls via headers
- SDK hooks enforce tenant context
- Never allow user to override tenant_id

### 6. **Error Handling**
- All API errors parsed in `sdk/core/error-handler.ts`
- UI components receive clear error messages
- Logging via `sdk/utils/logger.ts` (if applicable)

## Getting Started

### SDK Development
```bash
cd frontend/sdk
npm install
npm run build  # If using TypeScript/build tools
```

### Web App Development
```bash
cd frontend/web
npm install
npm run dev
```

### Using SDK in Web App

**Install SDK locally:**
```json
// frontend/web/package.json
{
  "dependencies": {
    "@app/sdk": "file:../sdk"
  }
}
```

**Import and use:**
```typescript
import { useConcepts } from '@app/sdk/features/concept';
import { useAuth } from '@app/sdk/core/auth';
```

## Testing

```bash
# Unit tests for SDK
cd frontend/sdk
npm test

# Component tests for web
cd frontend/web
npm test
```

## Deployment

1. Build SDK: `npm run build`
2. Build web app: `npm run build`
3. Ensure API endpoints (backend) are accessible
4. Set environment variables (API base URL, etc.)

## Compliance

✅ SDK-First Architecture
✅ Clean Separation of Concerns
✅ Multi-Tenancy Ready
✅ React Query for Data Management
✅ Type-Safe (TypeScript)
✅ No Direct API Calls in Web Layer

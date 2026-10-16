# Auto Proposal Full-Stack Application

Independent, self-contained Auto Proposal application with integrated React/Vite frontend and Express/TypeScript backend.

---

## Project Structure

```
Auto proposal frontend/
├── backend/                         # Migrated Express backend
│   ├── src/                         # Backend source code
│   │   ├── controllers/             # Request handlers & logic
│   │   ├── db/                      # SQLite schema, migrations & seed
│   │   ├── middleware/              # Error handling & file uploads
│   │   ├── routes/                  # Express API routers
│   │   ├── services/                # Pricing, AI, Document mutator, Word buffer
│   │   ├── tests/                   # 98 automated unit and route tests
│   │   └── server.ts                # Application entrypoint
│   ├── storage/                     # SQLite database & generated documents
│   ├── Mock Data/                   # Test datasets and sample docx templates
│   ├── package.json                 # Backend dependencies & scripts
│   ├── tsconfig.json                # Backend TypeScript configuration
│   └── .env.example                 # Backend environment variable template
├── src/                             # Frontend React + TypeScript application
│   ├── components/                  # UI components, builders, editors
│   ├── api/ or services/            # Frontend API client
│   └── App.tsx                      # Root application component
├── package.json                     # Root package configuration with helper scripts
├── vite.config.ts                   # Vite configuration with /api proxy to backend
└── README.md                        # Project documentation
```

---

## Prerequisites

- **Node.js**: v20+ recommended
- **npm**: v10+
- **LibreOffice** (Optional): For Stage 5 headless PDF conversion (`soffice.exe`). DOCX generation works natively without it.

---

## Environment Configuration

### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:
```env
PORT=3001
STORAGE_DIR=./storage
DB_PATH=./storage/database.sqlite

# AI Model Credentials
GEMINI_API_KEY=your_gemini_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Optional PDF export path (Windows default usually works)
SOFFICE_PATH=C:\Program Files\LibreOffice\program\soffice.exe
```

### Frontend (`.env`)
The frontend is preconfigured to use Vite's proxy to forward `/api` requests to the local backend:
```env
VITE_API_URL=/api
VITE_DEV_BACKEND_PORT=3001
```

---

## Installation

Install dependencies for both frontend and backend:

```powershell
# In project root:
npm install

# In backend directory:
cd backend
npm install
cd ..
```

---

## Running the Application (Windows)

You can run both servers conveniently using separate terminals:

### Terminal 1: Backend Server (Port 3001)
From project root:
```powershell
npm run dev:backend
```
*Or directly from the backend directory:*
```powershell
cd backend
npm run dev
```

### Terminal 2: Frontend Server (Port 5173)
From project root:
```powershell
npm run dev
```

Open your browser at `http://localhost:5173`. The frontend automatically proxies all `/api/*` calls to the backend on `http://127.0.0.1:3001`.

---

## Automated Testing & Verification

Run the full suite of backend and frontend checks directly from the project root:

```powershell
# 1. Run all 98 backend unit and integration tests:
npm run test:backend

# 2. Typecheck backend:
npm run typecheck:backend

# 3. Typecheck frontend:
npm run typecheck

# 4. Build both frontend and backend:
npm run build
npm run build:backend
```

All 98 backend tests pass, covering:
- Database initialization, schema migration, and seeding
- Document descriptor extraction and XML parsing
- Template mutation, tags, conditional flags, loops, and tier matrices
- Pricing engine rules compilation, evaluation, validation, and rounding
- Lead fact extraction with AI and natural-language clarification
- Proposal DOCX generation, word document buffers, and receipt generation


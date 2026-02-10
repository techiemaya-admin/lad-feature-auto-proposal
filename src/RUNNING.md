Run locally (Windows PowerShell)

1. Install dependencies:
```powershell
cd "c:\Users\lvdha\Downloads\rush-away-node-js-20260209T142028Z-1-001\rush-away-node-js"
npm install
```

2. Copy example env and edit DB settings:
```powershell
Copy-Item .env.example .env
# edit .env with your editor to set DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD
```

3. Create the database (example using `psql`):
```powershell
psql -h $env:DB_HOST -U $env:DB_USER -c "CREATE DATABASE $env:DB_NAME;"
```

4. (Optional) Run migrations (recommended for production):
```powershell
npm run migration:run
```

5. Start the server:
```powershell
npm run dev    # development with nodemon
# or
npm start      # production
```

6. Run tests:
```powershell
npx jest
```

Notes:
- The app reads `.env` via `src/index.js` using `dotenv`.
- In development (`NODE_ENV=development`) TypeORM `synchronize` is enabled. For production set `NODE_ENV=production` and run migrations instead of relying on `synchronize`.
- Tenant-scoped APIs require `X-Tenant-Id` header (except tenant management endpoints).

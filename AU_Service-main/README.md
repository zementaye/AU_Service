# AU Service Request System

This repo has two independent deployables — keep them as **separate Render
services** (which is how `backend/render.yaml` is already set up):

```
backend/    Express + Postgres API   → deploys as au-service-request-api
frontend/   Vite + React UI          → deploys as a static site
```

## Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET
npm start               # or: npm run dev
```

See `backend/README.md` for full details (schema, seeding, roles).

## Frontend

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL to your backend's URL
npm run dev
```

See `frontend/README.md` for what's implemented so far.

## Replacing your existing repo

Delete everything currently in the repo root and replace it with the
contents of this zip's `backend/` and `frontend/` folders — don't merge them
into one flat folder, since the frontend's `src/...` imports and the
backend's `require("./...")` calls both depend on the folder separation.

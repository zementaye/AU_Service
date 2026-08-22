# AU Service Request — Frontend

A Vite + React frontend for the AU_Service backend (Express/Postgres API).

This first build covers the **core flow**: login, viewing requests (received /
sent, with status + search filters), submitting a new request, and driving a
request through its lifecycle (submit → begin review → accept & assign →
complete → confirm & close, plus reject / reopen) with comments and an
activity history — all gated by the signed-in user's role, matching the
backend's `requireAuth` / `requireRole` checks.

Not yet built (say the word and I'll add these next): Super Admin console
(user & department management), notifications panel, reporting/analytics
views, department "focal point" queue dashboards, and file upload for
attachments (currently just a URL field).

## Setup

```bash
npm install
cp .env.example .env
# edit .env and point VITE_API_URL at your backend, e.g.:
# VITE_API_URL=https://au-service-request-api.onrender.com
npm run dev
```

Open http://localhost:5173. Log in with any user seeded by the backend's
`seedData.js` / `seed.js` (see the backend README for seeded credentials).

## Build

```bash
npm run build   # outputs to dist/
npm run preview # serve the production build locally
```

## Structure

```
src/
  lib/api.js            thin fetch wrapper over every backend route
  lib/statuses.js        shared lifecycle/status constants
  context/AuthContext.jsx  login/logout, token persisted in localStorage
  components/            Layout, StatusBadge, StatusRail, RequestCard, Modal
  pages/                  LoginPage, RequestsListPage, NewRequestPage, RequestDetailPage
```

## Notes on the role logic

The UI mirrors the backend's authorization rules so buttons only ever appear
when the action would actually succeed:

- **Requester** (whoever created the request): submit a draft, confirm-close
  or reopen a completed request.
- **Focal Point** (in the target department): begin review, accept & assign
  to a handler, or reject.
- **Handler** (assigned to the request): mark it completed.
- **Super Admin**: can act as any department's Focal Point / Handler.

If you add new statuses or actions on the backend, extend
`src/lib/statuses.js` (for the status rail) and the `can*` checks in
`RequestDetailPage.jsx`.

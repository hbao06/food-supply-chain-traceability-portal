# Frontend

React-based frontend for the Food Supply Chain Traceability & Provenance Portal.

Week 4 account screens use the Auth/Profile API from PR #42. Run the backend
with PostgreSQL to exercise registration, login, and profile changes end to end.

## Development

```bash
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:3000` by default. Set
`VITE_API_PROXY_TARGET` when the backend runs elsewhere. Docker Compose sets
it to `http://backend:3000`. Set `VITE_API_BASE_URL` for a deployed API on a
different origin.

Registration creates a PENDING account that must be activated by an admin.
The current profile API supports updating `name`; password change requires a
backend endpoint before it can be offered in the UI.

The current checkout has only `GET /api/health` in its backend. Until the
Auth/Profile backend from PR #42 is available locally and its PostgreSQL
database is running, registration and login cannot succeed. The frontend
shows an API-unavailable message when Vite's proxy cannot reach the backend.

To review the Profile UI without an Auth backend, open
`http://localhost:5173/profile?preview=1` while running the Vite dev server.
This development-only preview is clearly labeled, uses sample data, does not
call the API, and cannot save changes. A normal `/profile` visit still requires
an authenticated session.

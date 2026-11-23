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

The account-screen produce photograph is stored locally at
`public/account-produce.jpg` (source: Unsplash photo
`1542838132-92c53300491e`).

Run the backend and PostgreSQL database before testing or demonstrating the
portal end to end. All public trace and authenticated workspace screens fetch
live data from the backend API; the old `?preview=1` mock mode has been removed.

# Backend

Node.js + Express REST API for the Food Supply Chain Traceability & Provenance Portal.

## Development

```bash
npm install
npm run dev
```

## Tests

```bash
npm ci
npm test
```

Tests use Node.js's built-in test runner and start the Express app on a temporary
local port. They verify the health response, unknown-route handling, and browser
CORS access. No database, credentials, or additional test dependencies are needed.
CI runs these tests as a required step; failures are not ignored.

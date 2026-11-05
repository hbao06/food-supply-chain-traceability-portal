# Testing

This directory contains automated tests for the Food Supply Chain Traceability & Provenance Portal.

## Test Types

### Unit Tests

Tests individual functions or modules.

Location:

`tests/unit/`

### Integration Tests

Tests interactions between APIs and system components.

Location:

`tests/integration/`

## Tuần 4 — Auth/RBAC tests

`backend/test/auth.http.test.js` exercises the registration, login, profile, token, and role authorization HTTP flows through an Express app with the project's real controller, validators, error handler, bcrypt hasher, JWT service, and authentication/authorization middleware. It uses an in-memory repository, so no PostgreSQL service is required.

Run locally from `backend/`:

```powershell
$env:JWT_SECRET = 'test-only-secret-at-least-32-characters-long'
npm ci
npm test
```

Latest local run: **45 tests passed, 0 failed** (36 existing and 9 HTTP tests). CI runs the same `npm test` command with its test-only `JWT_SECRET`.

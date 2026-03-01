# Backend Test Guide

This directory contains shared backend test infrastructure.

## Canonical Test Pattern

Controller tests are co-located in `src/controllers/**` and should use helpers from `test/helpers.ts`.

Recommended suite setup:

```typescript
import { beforeAll, beforeEach, describe, it } from "bun:test";
import { createFreshTestApp, wipeTestDatabase, type TestApp } from "../../../test/helpers";

describe("Some Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  // Use only when tests in this suite need isolation between cases.
  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("does something", async () => {
    // ...
  });
});
```

## Safety Model

Tests are intentionally destructive and are guarded by strict interlocks.

- Test mode must be explicit: `NODE_ENV=test`
- Test DB must be explicit: `EPHEMERAL_TEST_DB_NAME`
- Wipe acknowledgment must be explicit:
  `TEST_DB_CARE_WIPED_EVERY_TEST_RUN=I_UNDERSTAND_THIS_TEST_DB_IS_WIPED_EVERY_TEST_RUN`
- Wipes are blocked unless connected DB exactly matches the configured ephemeral test DB
- Wipes use a single `dropDatabase()` call after safety checks

Important: do not set env variables inside test files. Configure them from scripts/runner.

## Shared Helpers

`test/helpers.ts` includes:

- `createTestApp()`: returns an Elysia app with routes mounted
- `createFreshTestApp()`: connect + wipe + create app
- `wipeTestDatabase()`: strict pre-wipe interlock + atomic database drop
- `seedTestDatabase()`: seed baseline test data
- `setupTestDatabase()`: wipe + seed
- `cleanupDatabase()`: disconnect mongoose when fully done
- `createTestUser()`, `createTestAdmin()`, `generateTestToken()`, `authHeader()`

## Running Tests

From `backend/`:

```bash
bun run test
```

Examples:

```bash
# Single file
bun test src/controllers/auth/login.controller.test.ts

# One controller group
bun test src/controllers/sessions/*.test.ts

# Health/system test
bun test test/health.test.ts
```

## Policy

- `specs/*` remains authoritative for behavioral/architecture rules
- `backend/README.md` is the canonical backend operational doc
- This file only documents backend testing workflow and helper usage

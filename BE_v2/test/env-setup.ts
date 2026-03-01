/**
 * Test environment defaults — loaded via bunfig.toml [test.preload].
 *
 * Only sets stub values that are NOT already present in the environment.
 * Real credentials (MONGO_URI, JWT_SECRET, etc.) must be supplied via .env
 * or the `bun run test` npm script; they are never overridden here.
 *
 * Law 3 / R11: env vars are provided by the test runner configuration
 * (bunfig.toml → preload), not mutated ad-hoc inside test files.
 */

// ── Per-file database isolation ──────────────────────────────────────────────
// Bun runs test files in parallel across workers. If all files share one
// database, any file's wipeTestDatabase() destroys another file's mid-test
// data — causing non-deterministic failures (IndexBuildAborted, missing docs,
// unique constraint collisions). Fix: each worker gets its own database.
// TEMPORARILY DISABLED for debugging — see if login test passes without this.
// const fileTestId = crypto.randomUUID().slice(0, 8);
// process.env["EPHEMERAL_TEST_DB_NAME"] = `wisdomlinked_test_${fileTestId}`;

// Database test-mode acknowledgment — required by database-env.ts when
// NODE_ENV=test.  This stub satisfies the interlock when running bun test
// directly (i.e. without the full npm test script that sets it inline).
process.env["TEST_DB_CARE_WIPED_EVERY_TEST_RUN"] ??=
  "I_UNDERSTAND_THIS_TEST_DB_IS_WIPED_EVERY_TEST_RUN";

// Service credentials — external services are not exercised in unit/integration
// tests; these stubs satisfy the env boundary so modules can be imported.

process.env["SENDGRID_API_KEY"] ??= "test-sendgrid-key";
process.env["SENDGRID_FROM_EMAIL"] ??= "test@wisdomlinked.com";

process.env["S3_ENDPOINT"] ??= "https://s3.amazonaws.com";
process.env["S3_REGION"] ??= "us-east-1";
process.env["S3_BUCKET"] ??= "wisdomlinked-test-bucket";
process.env["S3_ACCESS_KEY"] ??= "test-access-key";
process.env["S3_SECRET_KEY"] ??= "test-secret-key";

process.env["STRIPE_SECRET_KEY"] ??= "sk_test_stub_key";
process.env["STRIPE_WEBHOOK_SECRET"] ??= "whsec_test_stub_secret";

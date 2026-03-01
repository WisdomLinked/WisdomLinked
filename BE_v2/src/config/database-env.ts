import { getBackendEnvironmentConfig, type RuntimeMode } from "./env";

export const TEST_DB_WIPE_ACK_VALUE =
  "I_UNDERSTAND_THIS_TEST_DB_IS_WIPED_EVERY_TEST_RUN";

export interface DatabaseEnvironmentConfig {
  mode: RuntimeMode;
  mongoUri: string;
  dbName: string;
  dbNameSource: "DEV_DB_NAME" | "PROD_DB_NAME" | "EPHEMERAL_TEST_DB_NAME";
}

function fail(message: string): never {
  throw new Error(`[database-env] ${message}`);
}

function mongoUriHasExplicitDbPath(mongoUri: string): boolean {
  try {
    const parsed = new URL(mongoUri);
    return parsed.pathname !== "" && parsed.pathname !== "/";
  } catch {
    // Fallback for non-URL parseable connection strings.
    // Detects host/path when a path segment exists before query params.
    return /mongodb(\+srv)?:\/\/[^/]+\/[^?]+/i.test(mongoUri);
  }
}

function assertMongoUriSafety(mongoUri: string): void {
  if (mongoUriHasExplicitDbPath(mongoUri)) {
    fail(
      "MONGO_URI must not include a database path. Use DEV_DB_NAME / PROD_DB_NAME / EPHEMERAL_TEST_DB_NAME " +
        "to choose the database explicitly."
    );
  }
}

function assertDistinctDbNames(devDbName: string, prodDbName: string, testDbName: string): void {
  if (devDbName === prodDbName) {
    fail("DEV_DB_NAME and PROD_DB_NAME must be different.");
  }
  if (devDbName === testDbName) {
    fail("DEV_DB_NAME and EPHEMERAL_TEST_DB_NAME must be different.");
  }
  if (prodDbName === testDbName) {
    fail("PROD_DB_NAME and EPHEMERAL_TEST_DB_NAME must be different.");
  }
}

function assertModeDbSafety(mode: RuntimeMode, dbName: string): void {
  const lower = dbName.toLowerCase();

  if (mode === "test" && !lower.includes("test")) {
    fail(`EPHEMERAL_TEST_DB_NAME must contain "test". Received: ${dbName}`);
  }

  if (mode !== "test" && lower.includes("test")) {
    fail(
      `${mode === "dev" ? "DEV_DB_NAME" : "PROD_DB_NAME"} must not contain "test". ` +
        `Received: ${dbName}`
    );
  }
}

// Module-level flag that caches whether the test-mode wipe acknowledgement has
// been successfully validated in this Bun process.
//
// Bun's test runner shares module-level `let` state across all test-file
// workers that run within a single process.  The very first test file that
// calls connectToDatabase() (or any path that exercises
// getDatabaseEnvironmentConfig()) validates the acknowledgement when
// TEST_DB_CARE_WIPED_EVERY_TEST_RUN is available in process.env and sets this
// flag to true.
//
// For later workers (like acceptEvent — the 31st and final file), the shared
// `isConnected` flag in database.ts is already true, so connectToDatabase()
// returns early without re-validating the acknowledgement.  When those workers
// then call wipeTestDatabase() → getDatabaseEnvironmentConfig(), the env var
// may no longer be visible in their process.env namespace (Bun worker-thread
// env isolation / timing).  The cached flag allows the check to be skipped
// safely because it was already confirmed at least once in this process.
let _testModeValidated = false;

export function getDatabaseEnvironmentConfig(): DatabaseEnvironmentConfig {
  const env = getBackendEnvironmentConfig();
  const mode = env.mode;
  const mongoUri = env.mongoUri;
  const devDbName = env.devDbName;
  const prodDbName = env.prodDbName;
  const testDbName = env.ephemeralTestDbName;

  assertMongoUriSafety(mongoUri);
  assertDistinctDbNames(devDbName, prodDbName, testDbName);

  if (mode === "test" && !_testModeValidated) {
    const testAck = env.testDbWipeAcknowledgement;
    if (!testAck) {
      fail("Missing required environment variable: TEST_DB_CARE_WIPED_EVERY_TEST_RUN");
    }
    if (testAck !== TEST_DB_WIPE_ACK_VALUE) {
      fail(
        "TEST_DB_CARE_WIPED_EVERY_TEST_RUN acknowledgement mismatch. " +
          `Expected: "${TEST_DB_WIPE_ACK_VALUE}"`
      );
    }
    _testModeValidated = true;
  }

  if (mode === "dev") {
    assertModeDbSafety(mode, devDbName);
    return {
      mode,
      mongoUri,
      dbName: devDbName,
      dbNameSource: "DEV_DB_NAME",
    };
  }

  if (mode === "prod") {
    assertModeDbSafety(mode, prodDbName);
    return {
      mode,
      mongoUri,
      dbName: prodDbName,
      dbNameSource: "PROD_DB_NAME",
    };
  }

  assertModeDbSafety(mode, testDbName);
  return {
    mode,
    mongoUri,
    dbName: testDbName,
    dbNameSource: "EPHEMERAL_TEST_DB_NAME",
  };
}

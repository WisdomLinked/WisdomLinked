import mongoose from "mongoose";
import { getDatabaseEnvironmentConfig } from "./database-env";

let isConnected = false;

// Module-level cache of the actual database name we connected to.
// Shared across all Bun test workers (like isConnected) so that
// wipeTestDatabase() safety interlocks can verify against the real connected
// DB name rather than re-reading EPHEMERAL_TEST_DB_NAME from process.env
// (which varies per worker's preload but the actual connection does not).
let _connectedTestDbName: string | null = null;

/** Returns the name of the test database this process connected to, or null in non-test modes. */
export function getConnectedTestDbName(): string | null {
  return _connectedTestDbName;
}

const buildMongoUri = (mongoUri: string, dbName: string) => {
  try {
    const parsed = new URL(mongoUri);
    const hasDbPath = parsed.pathname && parsed.pathname !== "/";
    if (hasDbPath) {
      return mongoUri;
    }
    parsed.pathname = `/${dbName}`;
    return parsed.toString();
  } catch {
    const [base, query] = mongoUri.split("?");
    if (base.includes("/")) {
      return mongoUri;
    }
    return query ? `${base}/${dbName}?${query}` : `${base}/${dbName}`;
  }
};

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (isConnected) {
    return mongoose;
  }

  try {
    const envConfig = getDatabaseEnvironmentConfig();
    const connectionString = buildMongoUri(envConfig.mongoUri, envConfig.dbName);
    
    await mongoose.connect(connectionString);
    isConnected = true;
    
    // Extract DB name for logging
    const actualDbName = mongoose.connection.db?.databaseName || envConfig.dbName;

    // Cache the connected test DB name so that all test workers (which share
    // module-level state) can reference the same authoritative DB name in
    // safety interlocks, regardless of how their own preload set
    // EPHEMERAL_TEST_DB_NAME in their worker-local process.env.
    if (envConfig.mode === "test") {
      _connectedTestDbName = actualDbName;
    }
    console.log(
      `🧭 Database mode: ${envConfig.mode} (source: ${envConfig.dbNameSource})`
    );
    if (envConfig.mode === "test") {
      console.warn(`⚠️ Using TEST database: ${actualDbName}`);
    }
    console.log(`✅ Connected to MongoDB: ${actualDbName}`);
    return mongoose;
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Failed to disconnect from MongoDB:", error);
    throw error;
  }
}


import mongoose from "mongoose";
import { getDatabaseEnvironmentConfig } from "./database-env";

let isConnected = false;

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


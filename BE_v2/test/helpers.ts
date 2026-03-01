import { UserModel } from "../src/models/User";
import { SessionModel } from "../src/models/Session";
import { generateToken } from "../src/utils/jwt";
import { UserRole } from "../src/config/roles";
import { connectToDatabase } from "../src/config/database";
import { Elysia } from "elysia";
import { routes } from "../src/routes";
import { profileRoutes } from "../src/routes/v1/profile";
import { searchRoutes } from "../src/routes/v1/search";
import mongoose from "mongoose";
import { getDatabaseEnvironmentConfig } from "../src/config/database-env";

/**
 * Create a test app instance with proper type inference.
 * Includes all routes: core routes (from routes/index.ts) plus
 * wave-2 routes (profile, search) that Cassidy will wire in during review.
 */
export function createTestApp() {
  return new Elysia().use(routes).use(profileRoutes).use(searchRoutes);
}

export type TestApp = ReturnType<typeof createTestApp>;

export async function createFreshTestApp(): Promise<TestApp> {
  await connectToDatabase();
  await wipeTestDatabase();
  return createTestApp();
}

/**
 * Ensure we're using a test database and not production/development database
 * Call this before connecting to the database in tests
 */
export function ensureTestDatabase() {
  const config = getDatabaseEnvironmentConfig();
  if (config.mode !== "test") {
    throw new Error(
      `⚠️ SAFETY CHECK FAILED: Tests require NODE_ENV=test. Current mode: ${config.mode}`
    );
  }
}

function assertConnectedTestDatabaseInterlock(operation: string): { testDbName: string } {
  const config = getDatabaseEnvironmentConfig();
  if (config.mode !== "test") {
    throw new Error(
      `⚠️ SAFETY CHECK FAILED: ${operation} is only allowed in test mode. ` +
      `Current mode: ${config.mode}`
    );
  }

  const connectedDb = mongoose.connection.db;
  if (!connectedDb) {
    throw new Error(
      `⚠️ SAFETY CHECK FAILED: ${operation} requires an active database connection.`
    );
  }

  const connectedDbName = connectedDb.databaseName;
  if (connectedDbName !== config.dbName) {
    throw new Error(
      `⚠️ SAFETY CHECK FAILED: ${operation} target mismatch. ` +
      `Connected DB: ${connectedDbName}, expected test DB: ${config.dbName}`
    );
  }

  if (!connectedDbName.toLowerCase().includes("test")) {
    throw new Error(
      `⚠️ SAFETY CHECK FAILED: ${operation} blocked because DB name does not look ephemeral test-only: ` +
      connectedDbName
    );
  }

  return { testDbName: connectedDbName };
}

/**
 * Wipe all test data from the database
 * This should be called between tests or in beforeEach hooks
 */
export async function wipeTestDatabase() {
  // Safety gate is enforced at wipe-time so test files cannot bypass it by call ordering.
  ensureTestDatabase();
  const { testDbName } = assertConnectedTestDatabaseInterlock("wipeTestDatabase");

  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection is not available");
    }

    // Single-command drop after interlock checks to avoid partial wipes.
    await db.dropDatabase();
  } catch (error) {
    console.error(`Error wiping test database (${testDbName}):`, error);
    throw error;
  }
}

/**
 * Seed the database with essential test data
 * Call this after wiping to ensure consistent test state
 */
export async function seedTestDatabase() {
  assertConnectedTestDatabaseInterlock("seedTestDatabase");

  try {
    // Create an admin user for tests that require admin access
    const adminExists = await UserModel.findOne({ username: "administrator" });
    
    if (!adminExists) {
      await UserModel.create({
        username: "administrator",
        email: "admin@test.com",
        password: "hashed_admin_password",
        role: UserRole.ADMIN,
        isActive: true,
      });
    }
  } catch (error) {
    console.error('Error seeding test database:', error);
    throw error;
  }
}

/**
 * Setup test database - wipe and reseed
 * Call this in beforeEach or at the start of test suites
 */
export async function setupTestDatabase() {
  await wipeTestDatabase();
  await seedTestDatabase();
}

/**
 * Cleanup database connections at the very end of all tests
 * NOTE: Only call this once at the end of ALL tests, not between individual test files!
 * Use wipeTestDatabase() or setupTestDatabase() between test suites instead.
 */
export async function cleanupDatabase() {
  try {
    // Only disconnect if we're truly done with all tests
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      mongoose.connection.removeAllListeners();
    }
  } catch (error) {
    console.error('Error during database cleanup:', error);
  }
}

export interface TestUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  token: string;
}

/**
 * Create a test user and generate a valid token with session
 */
export async function createTestUser(
  username: string,
  email: string,
  role: UserRole = UserRole.CUSTOMER
): Promise<TestUser> {
  const user = await UserModel.create({
    username,
    email,
    password: "hashedpassword123",
    role,
    isActive: true,
  });

  const token = generateToken({
    userId: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
  });

  // Create session for the token
  await SessionModel.create({
    userId: user._id.toString(),
    token,
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isActive: true,
  });

  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    token,
  };
}

/**
 * Create authorization header with bearer token
 */
export function authHeader(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Create JSON headers
 */
export function jsonHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Clean up all test data except admin user
 */
export async function cleanupTestData() {
  assertConnectedTestDatabaseInterlock("cleanupTestData");
  await UserModel.deleteMany({ username: { $ne: "administrator" } });
  await SessionModel.deleteMany({});
}

/**
 * Get the admin user token
 */
export async function getAdminToken(): Promise<string | null> {
  const admin = await UserModel.findOne({ username: "administrator" });
  if (!admin) {
    return null;
  }

  const token = generateToken({
    userId: admin._id.toString(),
    username: admin.username,
    email: admin.email,
    role: admin.role,
  });

  // Create session for admin
  await SessionModel.create({
    userId: admin._id.toString(),
    token,
    ipAddress: "127.0.0.1",
    userAgent: "test-admin-agent",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isActive: true,
  });

  return token;
}


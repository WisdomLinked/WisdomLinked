export type RuntimeMode = "dev" | "prod" | "test";

type RequiredBackendEnvKey =
  | "NODE_ENV"
  | "MONGO_URI"
  | "DEV_DB_NAME"
  | "PROD_DB_NAME"
  | "EPHEMERAL_TEST_DB_NAME"
  | "JWT_SECRET"
  | "JWT_EXPIRES_IN";

type OptionalBackendEnvKey =
  | "PORT"
  | "FRONTEND_URL"
  | "TEST_DB_CARE_WIPED_EVERY_TEST_RUN"
  | "LIVEKIT_API_KEY"
  | "LIVEKIT_API_SECRET"
  | "LIVEKIT_URL"
  | "ADMIN_DEFAULT_EMAIL"
  | "ADMIN_DEFAULT_PASSWORD"
  | "SENDGRID_API_KEY"
  | "SENDGRID_FROM_EMAIL"
  | "S3_ENDPOINT"
  | "S3_REGION"
  | "S3_BUCKET"
  | "S3_ACCESS_KEY"
  | "S3_SECRET_KEY"
  | "STRIPE_SECRET_KEY"
  | "STRIPE_WEBHOOK_SECRET";

export interface BackendEnvironmentConfig {
  mode: RuntimeMode;
  mongoUri: string;
  devDbName: string;
  prodDbName: string;
  ephemeralTestDbName: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  port: number;
  frontendUrl: string;
  testDbWipeAcknowledgement?: string;
  // SendGrid — optional; sendgridEnabled is true only when both keys are present
  sendgridApiKey?: string;
  sendgridFromEmail?: string;
  sendgridEnabled: boolean;
  // S3 — optional; s3Enabled is true only when all five keys are present
  s3Endpoint?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Enabled: boolean;
  // Stripe — optional; stripeEnabled is true only when both keys are present
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripeEnabled: boolean;
  livekitApiKey?: string;
  livekitApiSecret?: string;
  livekitUrl?: string;
  adminDefaultEmail?: string;
  adminDefaultPassword?: string;
}

function fail(message: string): never {
  throw new Error(`[env] ${message}`);
}

function readTrimmedEnv(name: RequiredBackendEnvKey | OptionalBackendEnvKey): string | undefined {
  const value = process.env[name];
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function requireEnv(name: RequiredBackendEnvKey): string {
  const value = readTrimmedEnv(name);
  if (!value) {
    fail(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: OptionalBackendEnvKey): string | undefined {
  return readTrimmedEnv(name);
}

function parseRuntimeMode(nodeEnvRaw: string): RuntimeMode {
  const normalized = nodeEnvRaw.toLowerCase();

  if (normalized === "dev" || normalized === "development") {
    return "dev";
  }
  if (normalized === "prod" || normalized === "production") {
    return "prod";
  }
  if (normalized === "test") {
    return "test";
  }

  fail(
    `Invalid NODE_ENV="${nodeEnvRaw}". Allowed values: dev, prod, test ` +
      "(aliases: development -> dev, production -> prod)."
  );
}

function parsePort(portRaw: string | undefined): number {
  if (!portRaw) {
    return 5000;
  }

  const parsed = Number(portRaw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    fail(`PORT must be an integer between 1 and 65535. Received: ${portRaw}`);
  }

  return parsed;
}

function parseUrlOrFail(urlRaw: string, envName: "FRONTEND_URL"): string {
  try {
    new URL(urlRaw);
    return urlRaw;
  } catch {
    fail(`${envName} must be a valid absolute URL. Received: ${urlRaw}`);
  }
}

export function getBackendEnvironmentConfig(): BackendEnvironmentConfig {
  const nodeEnvRaw = requireEnv("NODE_ENV");
  const mode = parseRuntimeMode(nodeEnvRaw);

  const mongoUri = requireEnv("MONGO_URI");
  const devDbName = requireEnv("DEV_DB_NAME");
  const prodDbName = requireEnv("PROD_DB_NAME");
  const ephemeralTestDbName = requireEnv("EPHEMERAL_TEST_DB_NAME");
  const jwtSecret = requireEnv("JWT_SECRET");
  const jwtExpiresIn = requireEnv("JWT_EXPIRES_IN");
  const port = parsePort(optionalEnv("PORT"));
  const frontendUrl = parseUrlOrFail(optionalEnv("FRONTEND_URL") ?? "http://localhost:5173", "FRONTEND_URL");
  const testDbWipeAcknowledgement = optionalEnv("TEST_DB_CARE_WIPED_EVERY_TEST_RUN");

  const sendgridApiKey = optionalEnv("SENDGRID_API_KEY");
  const sendgridFromEmail = optionalEnv("SENDGRID_FROM_EMAIL");
  const sendgridEnabled = sendgridApiKey !== undefined && sendgridFromEmail !== undefined;

  const s3Endpoint = optionalEnv("S3_ENDPOINT");
  const s3Region = optionalEnv("S3_REGION");
  const s3Bucket = optionalEnv("S3_BUCKET");
  const s3AccessKey = optionalEnv("S3_ACCESS_KEY");
  const s3SecretKey = optionalEnv("S3_SECRET_KEY");
  const s3Enabled =
    s3Endpoint !== undefined &&
    s3Region !== undefined &&
    s3Bucket !== undefined &&
    s3AccessKey !== undefined &&
    s3SecretKey !== undefined;

  const stripeSecretKey = optionalEnv("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = optionalEnv("STRIPE_WEBHOOK_SECRET");
  const stripeEnabled = stripeSecretKey !== undefined && stripeWebhookSecret !== undefined;

  const livekitApiKey = optionalEnv("LIVEKIT_API_KEY");
  const livekitApiSecret = optionalEnv("LIVEKIT_API_SECRET");
  const livekitUrl = optionalEnv("LIVEKIT_URL");
  const adminDefaultEmail = optionalEnv("ADMIN_DEFAULT_EMAIL");
  const adminDefaultPassword = optionalEnv("ADMIN_DEFAULT_PASSWORD");

  return {
    mode,
    mongoUri,
    devDbName,
    prodDbName,
    ephemeralTestDbName,
    jwtSecret,
    jwtExpiresIn,
    port,
    frontendUrl,
    testDbWipeAcknowledgement,
    sendgridApiKey,
    sendgridFromEmail,
    sendgridEnabled,
    s3Endpoint,
    s3Region,
    s3Bucket,
    s3AccessKey,
    s3SecretKey,
    s3Enabled,
    stripeSecretKey,
    stripeWebhookSecret,
    stripeEnabled,
    livekitApiKey,
    livekitApiSecret,
    livekitUrl,
    adminDefaultEmail,
    adminDefaultPassword,
  };
}

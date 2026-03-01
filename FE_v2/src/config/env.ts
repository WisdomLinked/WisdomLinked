type OptionalFrontendEnvKey = "VITE_API_URL";

export interface FrontendEnvironmentConfig {
  apiBaseUrl: string;
}

function fail(message: string): never {
  throw new Error(`[frontend-env] ${message}`);
}

function optionalEnv(name: OptionalFrontendEnvKey): string | undefined {
  const raw = import.meta.env[name];
  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseAbsoluteUrl(urlRaw: string, envName: OptionalFrontendEnvKey): string {
  try {
    new URL(urlRaw);
    return urlRaw;
  } catch {
    fail(`${envName} must be a valid absolute URL. Received: ${urlRaw}`);
  }
}

export function getFrontendEnvironmentConfig(): FrontendEnvironmentConfig {
  const apiBaseUrl = parseAbsoluteUrl(optionalEnv("VITE_API_URL") ?? "http://localhost:5000", "VITE_API_URL");
  return { apiBaseUrl };
}

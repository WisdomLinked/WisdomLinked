/**
 * Persistence Boundary — the ONLY place in the codebase that may access localStorage.
 *
 * All reads/writes to localStorage MUST go through the exported functions here.
 * No other module (outside src/atoms/) may call localStorage directly.
 *
 * Key convention:   app:<area>:<name>:v<schemaVersion>
 * Envelope format:  { v: number, data: T, writtenAt: number }
 *
 * ESLint's no-restricted-properties / no-restricted-syntax are disabled for
 * src/atoms/ so localStorage access is intentionally allowed only in this file.
 */

// ---------------------------------------------------------------------------
// Failure types (structured, never silent)
// ---------------------------------------------------------------------------

export type PersistenceFailureKind =
  | "ParseError"
  | "SchemaError"
  | "UnsupportedVersion"
  | "QuotaExceeded"
  | "WriteError";

export type PersistenceActionTaken =
  | "migrated"
  | "resetToDefault"
  | "disabledPersistence";

export interface PersistenceFailure {
  readonly kind: PersistenceFailureKind;
  readonly key: string;
  readonly storedVersion: number | null;
  readonly currentVersion: number;
  readonly actionTaken: PersistenceActionTaken;
}

// ---------------------------------------------------------------------------
// Read / Write result types
// ---------------------------------------------------------------------------

export type ReadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly value: T; readonly failure: PersistenceFailure };

export type WriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failure: PersistenceFailure };

// ---------------------------------------------------------------------------
// Internal envelope type
// ---------------------------------------------------------------------------

interface PersistedEnvelope {
  readonly v: number;
  readonly data: unknown;
  readonly writtenAt: number;
}

function isPersistedEnvelope(raw: unknown): raw is PersistedEnvelope {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r["v"] === "number" &&
    Object.prototype.hasOwnProperty.call(r, "data") &&
    typeof r["writtenAt"] === "number"
  );
}

// Keys where writes have been permanently disabled for this session
// (quota exceeded or storage unavailable)
const disabledWriteKeys = new Set<string>();

// ---------------------------------------------------------------------------
// Read config
// ---------------------------------------------------------------------------

export interface PersistenceReadConfig<T> {
  /** Full versioned key: e.g. "app:prefs:theme:v1" */
  readonly key: string;
  readonly currentVersion: number;
  readonly validate: (raw: unknown) => raw is T;
  /**
   * Pure migration functions keyed by the stored version they upgrade FROM.
   * Partial because not every version number necessarily has a migration entry.
   */
  readonly migrations: Readonly<Partial<Record<number, (data: unknown) => unknown>>>;
  readonly defaultValue: T;
}

// ---------------------------------------------------------------------------
// persistenceRead
// ---------------------------------------------------------------------------

export function persistenceRead<T>(config: PersistenceReadConfig<T>): ReadResult<T> {
  const { key, currentVersion, validate, migrations, defaultValue } = config;

  // 1. Access localStorage
  let rawString: string | null;
  try {
    rawString = localStorage.getItem(key);
  } catch {
    return {
      ok: false,
      value: defaultValue,
      failure: {
        kind: "ParseError",
        key,
        storedVersion: null,
        currentVersion,
        actionTaken: "resetToDefault",
      },
    };
  }

  // 2. Nothing stored → return default (not a failure)
  if (rawString === null) {
    return { ok: true, value: defaultValue };
  }

  // 3. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawString);
  } catch {
    return {
      ok: false,
      value: defaultValue,
      failure: {
        kind: "ParseError",
        key,
        storedVersion: null,
        currentVersion,
        actionTaken: "resetToDefault",
      },
    };
  }

  // 4. Validate envelope shape
  if (!isPersistedEnvelope(parsed)) {
    return {
      ok: false,
      value: defaultValue,
      failure: {
        kind: "SchemaError",
        key,
        storedVersion: null,
        currentVersion,
        actionTaken: "resetToDefault",
      },
    };
  }

  const storedVersion = parsed.v;

  // 5. Handle future version (stored newer than code)
  if (storedVersion > currentVersion) {
    return {
      ok: false,
      value: defaultValue,
      failure: {
        kind: "UnsupportedVersion",
        key,
        storedVersion,
        currentVersion,
        actionTaken: "resetToDefault",
      },
    };
  }

  // 6. Apply migration chain if stored version is older
  let currentData: unknown = parsed.data;
  let version = storedVersion;

  while (version < currentVersion) {
    const migrateFn = migrations[version];
    if (migrateFn === undefined) {
      return {
        ok: false,
        value: defaultValue,
        failure: {
          kind: "UnsupportedVersion",
          key,
          storedVersion,
          currentVersion,
          actionTaken: "resetToDefault",
        },
      };
    }
    currentData = migrateFn(currentData);
    version += 1;
  }

  // 7. Validate the final data shape
  if (!validate(currentData)) {
    return {
      ok: false,
      value: defaultValue,
      failure: {
        kind: "SchemaError",
        key,
        storedVersion,
        currentVersion,
        actionTaken: "resetToDefault",
      },
    };
  }

  return { ok: true, value: currentData };
}

// ---------------------------------------------------------------------------
// Write config
// ---------------------------------------------------------------------------

export interface PersistenceWriteConfig {
  readonly key: string;
  readonly currentVersion: number;
}

// ---------------------------------------------------------------------------
// persistenceWrite
// ---------------------------------------------------------------------------

export function persistenceWrite<T>(config: PersistenceWriteConfig, value: T): WriteResult {
  const { key, currentVersion } = config;

  // Do not retry after a session-level storage failure
  if (disabledWriteKeys.has(key)) {
    return {
      ok: false,
      failure: {
        kind: "WriteError",
        key,
        storedVersion: null,
        currentVersion,
        actionTaken: "disabledPersistence",
      },
    };
  }

  const envelope: PersistedEnvelope = {
    v: currentVersion,
    data: value,
    writtenAt: Date.now(),
  };

  try {
    localStorage.setItem(key, JSON.stringify(envelope));
    return { ok: true };
  } catch {
    // Quota exceeded or storage blocked — disable for this session
    disabledWriteKeys.add(key);
    return {
      ok: false,
      failure: {
        kind: "QuotaExceeded",
        key,
        storedVersion: null,
        currentVersion,
        actionTaken: "disabledPersistence",
      },
    };
  }
}

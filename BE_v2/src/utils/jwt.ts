import jwt from "jsonwebtoken";
import { getBackendEnvironmentConfig } from "../config/env";

// JWT credentials are read lazily on each call so that:
//  1. Module import never throws if env vars are not yet set (e.g. during
//     test-runner preload sequencing).
//  2. Tests that mock/override process.env between cases see the fresh value.
// The env config function is pure-read (no side effects), so repeated calls
// are cheap and deterministic.

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
}

export function generateToken(payload: JWTPayload): string {
  const { jwtSecret, jwtExpiresIn } = getBackendEnvironmentConfig();
  return jwt.sign(payload, jwtSecret, {
    expiresIn: jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JWTPayload | null {
  const { jwtSecret } = getBackendEnvironmentConfig();
  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}


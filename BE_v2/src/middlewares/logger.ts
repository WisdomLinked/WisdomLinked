import { createLog, LogLevel } from "../models/Log";

export async function logError(message: string, metadata?: Record<string, unknown>) {
  await createLog(LogLevel.ERROR, message, metadata);
}

export async function logInfo(message: string, metadata?: Record<string, unknown>) {
  await createLog(LogLevel.INFO, message, metadata);
}

export async function logWarn(message: string, metadata?: Record<string, unknown>) {
  await createLog(LogLevel.WARN, message, metadata);
}

export async function logDebug(message: string, metadata?: Record<string, unknown>) {
  await createLog(LogLevel.DEBUG, message, metadata);
}


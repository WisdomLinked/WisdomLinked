import { Document, model, Model, models, Schema, Types } from "mongoose";

export enum LogLevel {
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  DEBUG = "debug",
}

export interface ILog {
  schemaVersion: number;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface ILogDocument extends ILog, Document<Types.ObjectId> {}

export type LogModelType = Model<ILogDocument>;

const LogSchema = new Schema<ILogDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    level: { type: String, enum: Object.values(LogLevel), required: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

// Index for faster queries
LogSchema.index({ timestamp: -1 });
LogSchema.index({ level: 1 });

export const LogModel =
  (models.Log as Model<ILogDocument>) || model<ILogDocument>("Log", LogSchema);

export async function createLog(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
) {
  try {
    return await LogModel.create({
      level,
      message,
      metadata,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Failed to create log:", error);
  }
}


import { Document, model, Model, models, Schema, Types } from "mongoose";

export interface ISession {
  schemaVersion: number;
  userId: Types.ObjectId;
  token: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo: {
    browser?: string;
    os?: string;
    device?: string;
  };
  isActive: boolean;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface ISessionDocument extends ISession, Document<Types.ObjectId> {}

const SessionSchema = new Schema<ISessionDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    deviceInfo: {
      browser: { type: String },
      os: { type: String },
      device: { type: String },
    },
    isActive: { type: Boolean, default: true, index: true },
    lastActivity: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
SessionSchema.index({ userId: 1, isActive: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export const SessionModel =
  (models.Session as Model<ISessionDocument>) ||
  model<ISessionDocument>("Session", SessionSchema);

// Helper function to parse user agent
export function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  
  // Detect OS
  let os = "Unknown";
  if (ua.includes("windows nt 10.0")) os = "Windows 10/11";
  else if (ua.includes("windows nt 6.3")) os = "Windows 8.1";
  else if (ua.includes("windows nt 6.2")) os = "Windows 8";
  else if (ua.includes("windows nt 6.1")) os = "Windows 7";
  else if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os x")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  // Detect Browser
  let browser = "Unknown";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("brave")) browser = "Brave";

  // Detect Device
  let device = "Desktop";
  if (ua.includes("mobile") || ua.includes("android")) device = "Mobile";
  else if (ua.includes("tablet") || ua.includes("ipad")) device = "Tablet";

  return { browser, os, device };
}

// Clean up expired sessions
export async function cleanupExpiredSessions() {
  const result = await SessionModel.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
}

// Invalidate all sessions for a user
export async function invalidateUserSessions(userId: string | Types.ObjectId) {
  await SessionModel.updateMany(
    { userId, isActive: true },
    { isActive: false }
  );
}


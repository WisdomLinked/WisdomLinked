import { Document, model, Model, models, Schema } from "mongoose";
import { UserRole } from "../config/roles";

export interface IPendingUser {
  schemaVersion: number;
  email: string;
  username: string;
  password: string;
  role: UserRole;
  verificationCode: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPendingUserDocument extends IPendingUser, Document {}

const PendingUserSchema = new Schema<IPendingUserDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    username: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      default: UserRole.CUSTOMER,
    },
    verificationCode: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index: MongoDB removes document automatically when expiresAt is reached
PendingUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingUserModel =
  (models.PendingUser as Model<IPendingUserDocument>) ||
  model<IPendingUserDocument>("PendingUser", PendingUserSchema);

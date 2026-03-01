import { Document, model, Model, models, Schema } from "mongoose";

export interface IPendingPasswordReset {
  schemaVersion: number;
  email: string;
  code: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPendingPasswordResetDocument extends IPendingPasswordReset, Document {}

const PendingPasswordResetSchema = new Schema<IPendingPasswordResetDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index: MongoDB removes document automatically when expiresAt is reached
PendingPasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingPasswordResetModel =
  (models.PendingPasswordReset as Model<IPendingPasswordResetDocument>) ||
  model<IPendingPasswordResetDocument>("PendingPasswordReset", PendingPasswordResetSchema);

import { Document, model, Model, models, Schema } from "mongoose";

export interface IPendingLogin {
  schemaVersion: number;
  email: string;
  code: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPendingLoginDocument extends IPendingLogin, Document {}

const PendingLoginSchema = new Schema<IPendingLoginDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index: MongoDB removes document automatically when expiresAt is reached
PendingLoginSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingLoginModel =
  (models.PendingLogin as Model<IPendingLoginDocument>) ||
  model<IPendingLoginDocument>("PendingLogin", PendingLoginSchema);

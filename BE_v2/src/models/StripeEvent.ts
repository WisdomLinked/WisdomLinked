import { Document, model, Model, models, Schema, Types } from "mongoose";

export enum StripeEventStatus {
  PENDING = "pending",
  PROCESSED = "processed",
  FAILED = "failed",
  IGNORED = "ignored",
}

export interface IStripeEvent {
  schemaVersion: number;
  stripeEventId: string;
  type: string;
  payload: Record<string, unknown>;
  status: StripeEventStatus;
  processedAt?: Date;
  failureReason?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStripeEventDocument extends IStripeEvent, Document<Types.ObjectId> {}

const StripeEventSchema = new Schema<IStripeEventDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    stripeEventId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: Object.values(StripeEventStatus), required: true, index: true },
    processedAt: { type: Date },
    failureReason: { type: String },
    retryCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const StripeEventModel =
  (models.StripeEvent as Model<IStripeEventDocument>) ||
  model<IStripeEventDocument>("StripeEvent", StripeEventSchema);

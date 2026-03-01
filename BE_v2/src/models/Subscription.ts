import { Document, model, Model, models, Schema, Types } from "mongoose";

export enum SubscriptionStatus {
  ACTIVE = "active",
  CANCELED = "canceled",
  PAST_DUE = "past_due",
  UNPAID = "unpaid",
  TRIALING = "trialing",
  INCOMPLETE = "incomplete",
  INCOMPLETE_EXPIRED = "incomplete_expired",
  PAUSED = "paused",
}

export interface ISubscription {
  schemaVersion: number;
  userId: Types.ObjectId;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionDocument extends ISubscription, Document<Types.ObjectId> {}

const SubscriptionSchema = new Schema<ISubscriptionDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    stripeSubscriptionId: { type: String, required: true, unique: true, index: true },
    stripeCustomerId: { type: String, required: true, index: true },
    stripePriceId: { type: String, required: true },
    planId: { type: String, required: true },
    status: { type: String, enum: Object.values(SubscriptionStatus), required: true, index: true },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    canceledAt: { type: Date },
    metadata: { type: Map, of: String, default: {} },
  },
  {
    timestamps: true,
  }
);

export const SubscriptionModel =
  (models.Subscription as Model<ISubscriptionDocument>) ||
  model<ISubscriptionDocument>("Subscription", SubscriptionSchema);

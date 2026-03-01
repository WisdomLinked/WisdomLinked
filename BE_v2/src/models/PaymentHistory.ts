import { Document, model, Model, models, Schema, Types } from "mongoose";

export type PaymentHistoryType =
  | "event"
  | "seminar"
  | "individual"
  | "subscription"
  | "adhoc";

export type PaymentHistoryStatus = "succeeded" | "failed" | "refunded" | "pending";

export interface IPaymentHistory {
  schemaVersion: number;
  userId: Types.ObjectId;
  amount: number;
  currency: string;
  stripePaymentIntentId: string;
  type: PaymentHistoryType;
  status: PaymentHistoryStatus;
  relatedEvent?: Types.ObjectId;
  relatedGroupChat?: Types.ObjectId;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentHistoryDocument extends IPaymentHistory, Document {}

const PaymentHistorySchema = new Schema<IPaymentHistoryDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "usd" },
    stripePaymentIntentId: { type: String, required: true },
    type: {
      type: String,
      enum: ["event", "seminar", "individual", "subscription", "adhoc"],
      required: true,
    },
    status: {
      type: String,
      enum: ["succeeded", "failed", "refunded", "pending"],
      required: true,
      default: "pending",
    },
    relatedEvent: { type: Schema.Types.ObjectId, ref: "Event" },
    relatedGroupChat: { type: Schema.Types.ObjectId, ref: "GroupChat" },
    description: { type: String },
  },
  { timestamps: true }
);

PaymentHistorySchema.index({ userId: 1 });
PaymentHistorySchema.index({ createdAt: -1 });
PaymentHistorySchema.index({ status: 1 });

export const PaymentHistoryModel =
  (models.PaymentHistory as Model<IPaymentHistoryDocument>) ||
  model<IPaymentHistoryDocument>("PaymentHistory", PaymentHistorySchema);

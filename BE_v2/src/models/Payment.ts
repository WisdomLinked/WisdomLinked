import { Document, model, Model, models, Schema, Types } from "mongoose";

export enum PaymentStatus {
  PENDING = "pending",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  CANCELED = "canceled",
  REFUNDED = "refunded",
}

export enum PaymentType {
  ONE_TIME = "one_time",
  SUBSCRIPTION_INITIAL = "subscription_initial",
  SUBSCRIPTION_RECURRING = "subscription_recurring",
}

export interface IPayment {
  schemaVersion: number;
  userId: Types.ObjectId;
  stripePaymentIntentId: string;
  stripeCustomerId: string;
  subscriptionId?: Types.ObjectId;
  type: PaymentType;
  status: PaymentStatus;
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  failureReason?: string;
  refundedAmount?: number;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentDocument extends IPayment, Document<Types.ObjectId> {}

const PaymentSchema = new Schema<IPaymentDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    stripePaymentIntentId: { type: String, required: true, unique: true, index: true },
    stripeCustomerId: { type: String, required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription" },
    type: { type: String, enum: Object.values(PaymentType), required: true },
    status: { type: String, enum: Object.values(PaymentStatus), required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    description: { type: String, default: "" },
    metadata: { type: Map, of: String, default: {} },
    failureReason: { type: String },
    refundedAmount: { type: Number },
    refundedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const PaymentModel =
  (models.Payment as Model<IPaymentDocument>) ||
  model<IPaymentDocument>("Payment", PaymentSchema);

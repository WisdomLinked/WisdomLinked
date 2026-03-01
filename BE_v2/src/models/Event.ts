import { Document, model, Model, models, Schema, Types } from "mongoose";

export type EventStatus = "pending" | "accepted" | "declined" | "cancelled" | "completed";

export interface IEvent {
  schemaVersion: number;
  expert: Types.ObjectId;
  customer: Types.ObjectId;
  start?: Date;
  end?: Date;
  duration?: number;
  title?: string;
  status: EventStatus;
  price?: number;
  /** The User who completed the payment for this event. */
  paidBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
  /** References to Feedback documents left for this event. */
  feedbacks: Types.ObjectId[];
  totalTimeSpent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEventDocument extends IEvent, Document {}

const EventSchema = new Schema<IEventDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    expert: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    start: { type: Date },
    end: { type: Date },
    duration: { type: Number },
    title: { type: String },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled", "completed"],
      required: true,
      default: "pending",
    },
    price: { type: Number },
    paidBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    feedbacks: [{ type: Schema.Types.ObjectId, ref: "User" }],
    totalTimeSpent: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

EventSchema.index({ expert: 1 });
EventSchema.index({ customer: 1 });
EventSchema.index({ status: 1 });
EventSchema.index({ start: 1 });

export const EventModel =
  (models.Event as Model<IEventDocument>) ||
  model<IEventDocument>("Event", EventSchema);

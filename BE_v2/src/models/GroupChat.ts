import { Document, model, Model, models, Schema, Types } from "mongoose";

export type GroupChatType = "seminar" | "individual" | "community";
export type GroupChatStatus = "pending" | "active" | "cancelled" | "completed";

export interface IGroupChat {
  schemaVersion: number;
  name: string;
  description?: string;
  type: GroupChatType;
  status: GroupChatStatus;
  /** The user who administers the group chat. */
  admin: Types.ObjectId;
  participants: Types.ObjectId[];
  createdBy: Types.ObjectId;
  keywords: Types.ObjectId[];
  services: Types.ObjectId[];
  start?: Date;
  end?: Date;
  duration?: number;
  price?: number;
  /** Users who have paid to access this group chat. */
  paidBy: Types.ObjectId[];
  isOpenToAll: boolean;
  totalTimeSpent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGroupChatDocument extends IGroupChat, Document {}

const GroupChatSchema = new Schema<IGroupChatDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    type: {
      type: String,
      enum: ["seminar", "individual", "community"],
      required: true,
      default: "seminar",
    },
    status: {
      type: String,
      enum: ["pending", "active", "cancelled", "completed"],
      required: true,
      default: "pending",
    },
    admin: { type: Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    keywords: [{ type: Schema.Types.ObjectId, ref: "Keyword" }],
    services: [{ type: Schema.Types.ObjectId, ref: "Service" }],
    start: { type: Date },
    end: { type: Date },
    duration: { type: Number },
    price: { type: Number },
    paidBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isOpenToAll: { type: Boolean, required: true, default: false },
    totalTimeSpent: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

GroupChatSchema.index({ type: 1 });
GroupChatSchema.index({ status: 1 });
GroupChatSchema.index({ admin: 1 });

export const GroupChatModel =
  (models.GroupChat as Model<IGroupChatDocument>) ||
  model<IGroupChatDocument>("GroupChat", GroupChatSchema);

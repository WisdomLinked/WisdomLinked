import { Document, model, Model, models, Schema, Types } from "mongoose";

export type PendingAppointmentStatus = "pending" | "approved" | "rejected";

export interface IPendingAppointmentToGroup {
  schemaVersion: number;
  userId: Types.ObjectId;
  groupChatId: Types.ObjectId;
  status: PendingAppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPendingAppointmentToGroupDocument
  extends IPendingAppointmentToGroup,
    Document {}

const PendingAppointmentToGroupSchema = new Schema<IPendingAppointmentToGroupDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    groupChatId: { type: Schema.Types.ObjectId, ref: "GroupChat", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
  },
  { timestamps: true }
);

PendingAppointmentToGroupSchema.index({ userId: 1 });
PendingAppointmentToGroupSchema.index({ groupChatId: 1 });

export const PendingAppointmentToGroupModel =
  (models.PendingAppointmentToGroup as Model<IPendingAppointmentToGroupDocument>) ||
  model<IPendingAppointmentToGroupDocument>(
    "PendingAppointmentToGroup",
    PendingAppointmentToGroupSchema
  );

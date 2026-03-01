import { Document, model, Model, models, Schema, Types } from "mongoose";

export type FriendInvitationStatus = "pending" | "accepted" | "rejected";

export interface IFriendInvitation {
  schemaVersion: number;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  status: FriendInvitationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFriendInvitationDocument extends IFriendInvitation, Document {}

const FriendInvitationSchema = new Schema<IFriendInvitationDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      required: true,
      default: "pending",
    },
  },
  { timestamps: true }
);

// Compound unique index prevents duplicate friend requests between same pair
FriendInvitationSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

export const FriendInvitationModel =
  (models.FriendInvitation as Model<IFriendInvitationDocument>) ||
  model<IFriendInvitationDocument>("FriendInvitation", FriendInvitationSchema);

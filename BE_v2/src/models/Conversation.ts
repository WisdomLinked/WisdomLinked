import { Document, model, Model, models, Schema, Types } from "mongoose";

export interface IConversation {
  schemaVersion: number;
  /** Exactly two User references — one per participant in the DM thread. */
  participants: Types.ObjectId[];
  /** Reference to the most recent Message in this thread. */
  lastMessage?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationDocument extends IConversation, Document {}

const ConversationSchema = new Schema<IConversationDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },
  },
  { timestamps: true }
);

ConversationSchema.index({ participants: 1 });

export const ConversationModel =
  (models.Conversation as Model<IConversationDocument>) ||
  model<IConversationDocument>("Conversation", ConversationSchema);

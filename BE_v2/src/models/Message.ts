import { Document, model, Model, models, Schema, Types } from "mongoose";

export type MessageType = "text" | "file" | "system";

export interface IMessage {
  schemaVersion: number;
  author: Types.ObjectId;
  content: string;
  type: MessageType;
  /** Present when this message belongs to a 1-on-1 Conversation. */
  conversationId?: Types.ObjectId;
  /** Present when this message belongs to a GroupChat. */
  groupChatId?: Types.ObjectId;
  /** S3 URL — present only when type is "file". */
  fileUrl?: string;
  readBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageDocument extends IMessage, Document {}

const MessageSchema = new Schema<IMessageDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    type: {
      type: String,
      enum: ["text", "file", "system"],
      required: true,
      default: "text",
    },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation" },
    groupChatId: { type: Schema.Types.ObjectId, ref: "GroupChat" },
    fileUrl: { type: String },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1 });
MessageSchema.index({ groupChatId: 1 });
MessageSchema.index({ createdAt: -1 });

export const MessageModel =
  (models.Message as Model<IMessageDocument>) ||
  model<IMessageDocument>("Message", MessageSchema);

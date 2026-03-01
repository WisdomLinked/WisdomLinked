import { Document, model, Model, models, Schema } from "mongoose";

export interface IChatBotQA {
  schemaVersion: number;
  question: string;
  answer: string;
  category?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatBotQADocument extends IChatBotQA, Document {}

const ChatBotQASchema = new Schema<IChatBotQADocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

ChatBotQASchema.index({ isActive: 1 });

export const ChatBotQAModel =
  (models.ChatBotQA as Model<IChatBotQADocument>) ||
  model<IChatBotQADocument>("ChatBotQA", ChatBotQASchema);

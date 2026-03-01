import { Document, model, Model, models, Schema } from "mongoose";

export interface IKeyword {
  schemaVersion: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IKeywordDocument extends IKeyword, Document {}

const KeywordSchema = new Schema<IKeywordDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    name: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

export const KeywordModel =
  (models.Keyword as Model<IKeywordDocument>) ||
  model<IKeywordDocument>("Keyword", KeywordSchema);

import { Document, model, Model, models, Schema } from "mongoose";

export interface IContactedUs {
  schemaVersion: number;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContactedUsDocument extends IContactedUs, Document {}

const ContactedUsSchema = new Schema<IContactedUsDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

ContactedUsSchema.index({ isRead: 1 });
ContactedUsSchema.index({ createdAt: -1 });

export const ContactedUsModel =
  (models.ContactedUs as Model<IContactedUsDocument>) ||
  model<IContactedUsDocument>("ContactedUs", ContactedUsSchema);

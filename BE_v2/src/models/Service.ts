import { Document, model, Model, models, Schema } from "mongoose";

export interface IService {
  schemaVersion: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IServiceDocument extends IService, Document {}

const ServiceSchema = new Schema<IServiceDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    name: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

export const ServiceModel =
  (models.Service as Model<IServiceDocument>) ||
  model<IServiceDocument>("Service", ServiceSchema);

import { Document, model, Model, models, Schema, Types } from "mongoose";

export interface IMetrics {
  schemaVersion: number;
  path: string;
  method: string;
  ip: string;
  username?: string;
  userId?: string;
  isAuthenticated: boolean;
  timestamp: Date;
  responseTime?: number;
  statusCode?: number;
}

export interface IMetricsDocument extends IMetrics, Document<Types.ObjectId> {}

export type MetricsModelType = Model<IMetricsDocument>;

const MetricsSchema = new Schema<IMetricsDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    path: { type: String, required: true },
    method: { type: String, required: true },
    ip: { type: String, required: true },
    username: { type: String },
    userId: { type: String },
    isAuthenticated: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    responseTime: { type: Number },
    statusCode: { type: Number },
  },
  {
    timestamps: false,
  }
);

// Indexes for faster queries
MetricsSchema.index({ timestamp: -1 });
MetricsSchema.index({ path: 1 });
MetricsSchema.index({ isAuthenticated: 1 });
MetricsSchema.index({ ip: 1 });

export const MetricsModel =
  (models.Metrics as Model<IMetricsDocument>) || model<IMetricsDocument>("Metrics", MetricsSchema);


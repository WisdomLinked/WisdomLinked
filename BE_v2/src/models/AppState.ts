import { Document, model, Model, models, Schema } from "mongoose";

export type StripeMode = "test" | "live";

export interface IAppState {
  schemaVersion: number;
  stripeMode: StripeMode;
  maintenanceMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAppStateDocument extends IAppState, Document {}

const AppStateSchema = new Schema<IAppStateDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    stripeMode: {
      type: String,
      enum: ["test", "live"],
      required: true,
      default: "test",
    },
    maintenanceMode: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

export const AppStateModel =
  (models.AppState as Model<IAppStateDocument>) ||
  model<IAppStateDocument>("AppState", AppStateSchema);

/**
 * Singleton accessor — ensures exactly one AppState document exists.
 * Call this instead of AppStateModel.findOne() directly.
 */
export async function getAppState(): Promise<IAppStateDocument> {
  const existing = await AppStateModel.findOne().exec();
  if (existing) {
    return existing;
  }
  return AppStateModel.create({
    stripeMode: "test",
    maintenanceMode: false,
  });
}

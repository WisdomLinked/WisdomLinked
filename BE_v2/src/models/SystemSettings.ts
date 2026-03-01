import { Document, model, Model, models, Schema, Types } from "mongoose";

export interface StripePricingPlan {
  id: string;
  name: string;
  description: string;
  stripePriceId: string;
  type: "subscription" | "one_time";
  currency: string;
  amount: number;
  interval?: "month" | "year";
  features: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface ISystemSettings {
  schemaVersion: number;
  registrationEnabled: boolean;
  loginMethods: {
    local: boolean;
    discord: boolean;
  };
  discordOAuth: {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
  };
  stripeConfig: {
    publishableKey?: string;
    secretKey?: string;
    webhookSecret?: string;
    enabled: boolean;
  };
  stripePricing: {
    plans: StripePricingPlan[];
  };
  updatedAt: Date;
}

export interface ISystemSettingsDocument extends ISystemSettings, Document<Types.ObjectId> {}

const StripePricingPlanSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  stripePriceId: { type: String, required: true },
  type: { type: String, enum: ["subscription", "one_time"], required: true },
  currency: { type: String, required: true },
  amount: { type: Number, required: true },
  interval: { type: String, enum: ["month", "year"] },
  features: [{ type: String }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const SystemSettingsSchema = new Schema<ISystemSettingsDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    registrationEnabled: { type: Boolean, default: true },
    loginMethods: {
      local: { type: Boolean, default: true },
      discord: { type: Boolean, default: false },
    },
    discordOAuth: {
      clientId: { type: String },
      clientSecret: { type: String },
      redirectUri: { type: String },
    },
    stripeConfig: {
      publishableKey: { type: String },
      secretKey: { type: String },
      webhookSecret: { type: String },
      enabled: { type: Boolean, default: false },
    },
    stripePricing: {
      plans: [StripePricingPlanSchema],
    },
  },
  {
    timestamps: true,
  }
);

export const SystemSettingsModel =
  (models.SystemSettings as Model<ISystemSettingsDocument>) ||
  model<ISystemSettingsDocument>("SystemSettings", SystemSettingsSchema);

// Singleton pattern - only one settings document
export async function getSystemSettings() {
  let settings = await SystemSettingsModel.findOne();
  
  if (!settings) {
    settings = await SystemSettingsModel.create({
      registrationEnabled: true,
      loginMethods: {
        local: true,
        discord: false,
      },
      stripeConfig: {
        enabled: false,
      },
      stripePricing: {
        plans: [],
      },
    });
  }
  
  return settings;
}

export async function updateSystemSettings(updates: Partial<ISystemSettings>) {
  const settings = await getSystemSettings();
  Object.assign(settings, updates);
  await settings.save();
  return settings;
}


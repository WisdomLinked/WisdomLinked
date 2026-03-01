import { Document, model, Model, models, Schema, Types } from "mongoose";
import { UserRole } from "../config/roles";
import { getBackendEnvironmentConfig } from "../config/env";
import { hashPassword } from "../utils/hash";
import { SubscriptionStatus } from "./Subscription";

export enum AuthMethod {
  LOCAL = "local",
  DISCORD = "discord",
}

export interface OAuthConnection {
  provider: "discord";
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  guildIds?: string[];
  guildCount?: number;
  accountCreatedAt?: Date;
  accountAgeDays?: number;
  lastVerifiedAt?: Date;
}

export interface UserSubscription {
  subscriptionId: Types.ObjectId;
  planId: string;
  status: SubscriptionStatus;
}

export interface IUserFeedback {
  rating: number;
  comment?: string;
  fromUser: Types.ObjectId;
  event?: Types.ObjectId;
  createdAt: Date;
}

export interface IUser {
  schemaVersion: number;
  username: string;
  email: string;
  password?: string; // Optional for OAuth users
  role: UserRole;
  isActive: boolean;
  authMethods: AuthMethod[];
  oauthConnections: OAuthConnection[];
  stripeCustomerId?: string;
  subscription?: UserSubscription;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLogin?: Date;
  // WisdomLinked profile fields
  phoneNumber?: string;
  country?: string;
  state?: string;
  city?: string;
  image?: string;
  friends: Types.ObjectId[];
  groupChats: Types.ObjectId[];
  generalChats: Types.ObjectId[];
  events: Types.ObjectId[];
  keywords: Types.ObjectId[];
  services: Types.ObjectId[];
  feedbacks: IUserFeedback[];
  status: "review" | "active" | "blocked";
  timeZone?: string;
  isAdHocCustomer: boolean;
  joinPopupBlocked: boolean;
  missedChats: Map<string, number>;
  // Expert-specific fields
  title?: string;
  resume?: string;
  description?: string;
  timeSlots: number[];
  dailyTimeSlots: number[];
  price: number[];
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document<Types.ObjectId> {}

export type UserModelType = Model<IUserDocument>;

const OAuthConnectionSchema = new Schema({
  provider: { type: String, required: true },
  providerId: { type: String, required: true },
  accessToken: { type: String },
  refreshToken: { type: String },
  expiresAt: { type: Date },
  guildIds: [{ type: String }],
  guildCount: { type: Number, default: 0 },
  accountCreatedAt: { type: Date },
  accountAgeDays: { type: Number },
  lastVerifiedAt: { type: Date },
}, { _id: false });

const UserSubscriptionSchema = new Schema({
  subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", required: true },
  planId: { type: String, required: true },
  status: { type: String, enum: Object.values(SubscriptionStatus), required: true },
}, { _id: false });

const UserFeedbackSchema = new Schema({
  rating: { type: Number, required: true },
  comment: { type: String },
  fromUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
  event: { type: Schema.Types.ObjectId, ref: "Event" },
  createdAt: { type: Date, required: true, default: Date.now },
}, { _id: false });

const UserSchema = new Schema<IUserDocument>(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, select: false }, // Hidden by default — use .select("+password") when needed
    role: { type: String, enum: Object.values(UserRole), default: UserRole.CUSTOMER },
    isActive: { type: Boolean, default: true },
    authMethods: [{ type: String, enum: Object.values(AuthMethod), default: [AuthMethod.LOCAL] }],
    oauthConnections: { type: [OAuthConnectionSchema], select: false },
    stripeCustomerId: { type: String, index: true },
    subscription: { type: UserSubscriptionSchema },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLogin: { type: Date },
    // WisdomLinked profile fields
    phoneNumber: { type: String },
    country: { type: String },
    state: { type: String },
    city: { type: String },
    image: { type: String },
    friends: [{ type: Schema.Types.ObjectId, ref: "User" }],
    groupChats: [{ type: Schema.Types.ObjectId, ref: "GroupChat" }],
    generalChats: [{ type: Schema.Types.ObjectId, ref: "Conversation" }],
    events: [{ type: Schema.Types.ObjectId, ref: "Event" }],
    keywords: [{ type: Schema.Types.ObjectId, ref: "Keyword" }],
    services: [{ type: Schema.Types.ObjectId, ref: "Service" }],
    feedbacks: [UserFeedbackSchema],
    status: { type: String, enum: ["review", "active", "blocked"], default: "active" },
    timeZone: { type: String },
    isAdHocCustomer: { type: Boolean, default: false },
    joinPopupBlocked: { type: Boolean, default: false },
    missedChats: { type: Map, of: Number, default: () => new Map<string, number>(), select: false },
    // Expert-specific fields
    title: { type: String },
    resume: { type: String },
    description: { type: String },
    timeSlots: [{ type: Number }],
    dailyTimeSlots: [{ type: Number }],
    price: [{ type: Number }],
    rating: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ keywords: 1 });
UserSchema.index({ services: 1 });

export const UserModel =
  (models.User as Model<IUserDocument>) || model<IUserDocument>("User", UserSchema);

export async function seedAdminUser() {
  const config = getBackendEnvironmentConfig();

  if (!config.adminDefaultPassword) {
    console.log("⏭️ Admin seeding skipped — ADMIN_DEFAULT_PASSWORD not set");
    return null;
  }

  const adminEmail = config.adminDefaultEmail ?? "admin@wisdomlinked.com";
  const adminUsername = "administrator";
  const existing = await UserModel.findOne({ username: adminUsername }).lean().exec();

  if (existing) {
    // Update existing admin user if it's missing new fields
    const updates: { isActive?: boolean; authMethods?: AuthMethod[]; oauthConnections?: OAuthConnection[] } = {};
    let needsUpdate = false;

    if (existing.isActive === undefined) {
      updates.isActive = true;
      needsUpdate = true;
    }

    if (!existing.authMethods || existing.authMethods.length === 0) {
      updates.authMethods = [AuthMethod.LOCAL];
      needsUpdate = true;
    }

    if (!existing.oauthConnections) {
      updates.oauthConnections = [];
      needsUpdate = true;
    }

    if (needsUpdate) {
      await UserModel.updateOne({ username: adminUsername }, updates);
      console.log("✅ Admin user updated with new fields");
    } else {
      console.log("✅ Admin user already exists");
    }

    return existing;
  }

  const hashedPassword = await hashPassword(config.adminDefaultPassword);

  const admin = await UserModel.create({
    username: adminUsername,
    email: adminEmail,
    password: hashedPassword,
    role: UserRole.ADMIN,
    isActive: true,
    authMethods: [AuthMethod.LOCAL],
    oauthConnections: [],
  });

  console.log("✅ Admin user created successfully");
  return admin;
}


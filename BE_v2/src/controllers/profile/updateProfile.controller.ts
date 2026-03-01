import { Context, Elysia, t } from "elysia";
import { AuthUser, requireAuth } from "../../middlewares/auth";
import { UserModel } from "../../models/User";
import { UserRole } from "../../config/roles";

// Fields any authenticated user may update
const sharedUpdateFields = {
  phoneNumber: t.Optional(t.String()),
  country: t.Optional(t.String()),
  state: t.Optional(t.String()),
  city: t.Optional(t.String()),
  timeZone: t.Optional(t.String()),
};

// Fields only experts (and admins) may update
const expertUpdateFields = {
  title: t.Optional(t.String()),
  description: t.Optional(t.String()),
  timeSlots: t.Optional(t.Array(t.Number())),
  dailyTimeSlots: t.Optional(t.Array(t.Number())),
  price: t.Optional(t.Array(t.Number())),
  keywords: t.Optional(t.Array(t.String())),
  services: t.Optional(t.Array(t.String())),
};

export const updateProfileController = new Elysia()
  .use(requireAuth)
  .put("/", async (context) => {
    const { user, body, set } = context as Context & {
      user: AuthUser;
      body: {
        phoneNumber?: string;
        country?: string;
        state?: string;
        city?: string;
        timeZone?: string;
        title?: string;
        description?: string;
        timeSlots?: number[];
        dailyTimeSlots?: number[];
        price?: number[];
        keywords?: string[];
        services?: string[];
      };
    };

    try {
      // Collect allowed update fields
      const updates: Record<string, unknown> = {};

      // Shared fields — all roles
      if (body.phoneNumber !== undefined) updates.phoneNumber = body.phoneNumber;
      if (body.country !== undefined) updates.country = body.country;
      if (body.state !== undefined) updates.state = body.state;
      if (body.city !== undefined) updates.city = body.city;
      if (body.timeZone !== undefined) updates.timeZone = body.timeZone;

      // Expert-only fields — reject for non-experts/admins
      const expertOnlyFields = [
        "title",
        "description",
        "timeSlots",
        "dailyTimeSlots",
        "price",
        "keywords",
        "services",
      ] as const;

      const hasExpertFields = expertOnlyFields.some(
        (f) => (body as Record<string, unknown>)[f] !== undefined
      );

      if (
        hasExpertFields &&
        user.role !== UserRole.EXPERT &&
        user.role !== UserRole.ADMIN
      ) {
        set.status = 403;
        return {
          error: "Expert-only fields may only be updated by experts or admins",
        };
      }

      if (user.role === UserRole.EXPERT || user.role === UserRole.ADMIN) {
        if (body.title !== undefined) updates.title = body.title;
        if (body.description !== undefined) updates.description = body.description;
        if (body.timeSlots !== undefined) updates.timeSlots = body.timeSlots;
        if (body.dailyTimeSlots !== undefined) updates.dailyTimeSlots = body.dailyTimeSlots;
        if (body.price !== undefined) updates.price = body.price;
        if (body.keywords !== undefined) updates.keywords = body.keywords;
        if (body.services !== undefined) updates.services = body.services;
      }

      if (Object.keys(updates).length === 0) {
        set.status = 400;
        return { error: "No updatable fields provided" };
      }

      const updatedUser = await UserModel.findByIdAndUpdate(
        user.userId,
        updates,
        { new: true }
      )
        .lean()
        .exec();

      if (!updatedUser) {
        set.status = 404;
        return { error: "User not found" };
      }

      return { user: updatedUser };
    } catch (error) {
      set.status = 500;
      return {
        error: "Failed to update profile",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }, {
    body: t.Object({
      ...sharedUpdateFields,
      ...expertUpdateFields,
    }),
  });

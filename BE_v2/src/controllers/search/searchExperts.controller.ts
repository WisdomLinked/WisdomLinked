import { Elysia, t } from "elysia";
import { requireAuth } from "../../middlewares/auth";
import { UserModel } from "../../models/User";
import { UserRole } from "../../config/roles";

type ExpertSearchFilter = {
  role: string;
  status: string;
  rating?: { $gte: number };
  $or?: Array<{ username: { $regex: string; $options: "i" } }>;
  keywords?: { $in: string[] };
  services?: { $in: string[] };
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const searchExpertsController = new Elysia()
  .use(requireAuth)
  .get(
    "/",
    async (context) => {
      try {
        const {
          name,
          keywords,
          services,
          page = 1,
          limit = 20,
        } = context.query;

        const rating = context.query.rating;

        const filter: ExpertSearchFilter = {
          role: UserRole.EXPERT,
          status: "active",
        };

        if (name && name.trim().length > 0) {
          filter.$or = [
            { username: { $regex: escapeRegex(name.trim()), $options: "i" } },
          ];
        }

        if (rating !== undefined) {
          filter.rating = { $gte: rating };
        }

        // keywords is a comma-separated list of keyword IDs
        if (keywords && keywords.trim().length > 0) {
          const keywordIds = keywords
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k.length > 0);
          if (keywordIds.length > 0) {
            filter.keywords = { $in: keywordIds };
          }
        }

        // services is a comma-separated list of service IDs
        if (services && services.trim().length > 0) {
          const serviceIds = services
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (serviceIds.length > 0) {
            filter.services = { $in: serviceIds };
          }
        }

        const pageNum = Math.max(1, page);
        const limitNum = Math.min(100, Math.max(1, limit));
        const skip = (pageNum - 1) * limitNum;

        const [experts, total] = await Promise.all([
          UserModel.find(filter)
            .select(
              "-password -passwordResetToken -oauthConnections -missedChats"
            )
            .populate("keywords", "name")
            .populate("services", "name")
            .sort({ rating: -1, createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
          UserModel.countDocuments(filter),
        ]);

        return {
          experts: experts.map((e) => ({
            id: e._id.toString(),
            username: e.username,
            email: e.email,
            role: e.role,
            title: e.title,
            description: e.description,
            image: e.image,
            rating: e.rating,
            price: e.price,
            timeSlots: e.timeSlots,
            keywords: e.keywords,
            services: e.services,
            country: e.country,
            city: e.city,
            timeZone: e.timeZone,
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        };
      } catch (error) {
        context.set.status = 500;
        return {
          error: "Failed to search experts",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      query: t.Object({
        name: t.Optional(t.String({ maxLength: 100 })),
        keywords: t.Optional(t.String()),
        services: t.Optional(t.String()),
        rating: t.Optional(t.Numeric({ minimum: 0, maximum: 5 })),
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      }),
    }
  );

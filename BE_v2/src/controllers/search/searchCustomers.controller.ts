import { Elysia, t } from "elysia";
import { AuthUser, requireAuth } from "../../middlewares/auth";
import { UserModel } from "../../models/User";
import { UserRole } from "../../config/roles";

type CustomerSearchFilter = {
  role: string;
  $or?: Array<{ username: { $regex: string; $options: "i" } }>;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const searchCustomersController = new Elysia()
  .use(requireAuth)
  .get(
    "/",
    async (context) => {
      const user = (context as typeof context & { user: AuthUser }).user;

      // Only admins and experts may search customers
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.EXPERT) {
        context.set.status = 403;
        return { error: "Access denied. Admin or expert role required" };
      }

      try {
        const { name, page = 1, limit = 20 } = context.query;

        const filter: CustomerSearchFilter = {
          role: UserRole.CUSTOMER,
        };

        if (name && name.trim().length > 0) {
          filter.$or = [
            { username: { $regex: escapeRegex(name.trim()), $options: "i" } },
          ];
        }

        const pageNum = Math.max(1, page);
        const limitNum = Math.min(100, Math.max(1, limit));
        const skip = (pageNum - 1) * limitNum;

        const [customers, total] = await Promise.all([
          UserModel.find(filter)
            
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
          UserModel.countDocuments(filter),
        ]);

        return {
          customers: customers.map((c) => ({
            id: c._id.toString(),
            username: c.username,
            email: c.email,
            role: c.role,
            isActive: c.isActive,
            status: c.status,
            image: c.image,
            country: c.country,
            city: c.city,
            createdAt: c.createdAt,
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
          error: "Failed to search customers",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      query: t.Object({
        name: t.Optional(t.String({ maxLength: 100 })),
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      }),
    }
  );

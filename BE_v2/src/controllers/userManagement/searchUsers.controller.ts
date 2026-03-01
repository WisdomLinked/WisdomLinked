import { Elysia, t } from "elysia";
import { UserModel } from "../../models/User";
import { requireAdmin } from "../../middlewares/auth";

type UserSearchQuery = {
  $or?: Array<
    | { username: { $regex: string; $options: "i" } }
    | { email: { $regex: string; $options: "i" } }
  >;
  role?: string;
  isActive?: boolean;
  authMethods?: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Search and list users
export const searchUsersController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    try {
      const { search, role, isActive, page = 1, limit = 20, authMethod } = context.query;

      const query: UserSearchQuery = {};

      // Build search query
      if (search && search.trim().length > 0) {
        const safeSearch = escapeRegex(search.trim());
        query.$or = [
          { username: { $regex: safeSearch, $options: "i" } },
          { email: { $regex: safeSearch, $options: "i" } },
        ];
      }

      if (role) {
        query.role = role;
      }

      if (isActive !== undefined) {
        query.isActive = isActive === "true";
      }

      if (authMethod) {
        query.authMethods = authMethod;
      }

      const pageNum = Math.max(1, page);
      const limitNum = Math.min(100, Math.max(1, limit));
      const skip = (pageNum - 1) * limitNum;

      const [users, total] = await Promise.all([
        UserModel.find(query)
          
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        UserModel.countDocuments(query),
      ]);

      return {
        users: users.map((user) => ({
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          authMethods: user.authMethods,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to search users", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to search users", message: "Unknown error" };
    }
  }, {
    query: t.Object({
      search: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      role: t.Optional(t.String()),
      isActive: t.Optional(t.Union([t.Literal("true"), t.Literal("false")])),
      page: t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      authMethod: t.Optional(t.String()),
    }),
  });


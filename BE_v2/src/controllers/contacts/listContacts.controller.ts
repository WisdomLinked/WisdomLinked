import { Elysia, t } from "elysia";
import { requireAdmin } from "../../middlewares/auth";
import { ContactedUsModel } from "../../models/ContactedUs";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type ContactsSearchFilter = {
  $or?: Array<
    | { name: { $regex: string; $options: "i" } }
    | { email: { $regex: string; $options: "i" } }
  >;
  isRead?: boolean;
};

export const listContactsController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    try {
      const { page = 1, limit = 20, search, isRead } = context.query;

      const filter: ContactsSearchFilter = {};

      if (search !== undefined && search.trim().length > 0) {
        const safe = escapeRegex(search.trim());
        filter.$or = [
          { name: { $regex: safe, $options: "i" } },
          { email: { $regex: safe, $options: "i" } },
        ];
      }

      if (isRead !== undefined) {
        filter.isRead = isRead === "true";
      }

      const pageNum = Math.max(1, page);
      const limitNum = Math.min(100, Math.max(1, limit));
      const skip = (pageNum - 1) * limitNum;

      const [data, total] = await Promise.all([
        ContactedUsModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        ContactedUsModel.countDocuments(filter),
      ]);

      return {
        data: data.map((item) => ({
          id: item._id.toString(),
          name: item.name,
          email: item.email,
          message: item.message,
          isRead: item.isRead,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
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
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: "Failed to list contacts", message };
    }
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      search: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
      isRead: t.Optional(t.Union([t.Literal("true"), t.Literal("false")])),
    }),
  });

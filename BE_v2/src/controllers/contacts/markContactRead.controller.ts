import { Elysia, t } from "elysia";
import { Types } from "mongoose";
import { requireAdmin } from "../../middlewares/auth";
import { ContactedUsModel } from "../../models/ContactedUs";

type ContactIdParams = { id: string };

export const markContactReadController = new Elysia()
  .use(requireAdmin)
  .put("/:id/read", async ({ params, set }) => {
    const { id } = params as ContactIdParams;

    if (!Types.ObjectId.isValid(id)) {
      set.status = 400;
      return { error: "Invalid ID" };
    }

    try {
      const doc = await ContactedUsModel.findByIdAndUpdate(
        id,
        { isRead: true },
        { new: true }
      )
        .lean()
        .exec();

      if (!doc) {
        set.status = 404;
        return { error: "Contact not found" };
      }

      return {
        data: {
          id: doc._id.toString(),
          name: doc.name,
          email: doc.email,
          message: doc.message,
          isRead: doc.isRead,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        },
      };
    } catch (error) {
      set.status = 500;
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: "Failed to mark contact as read", message };
    }
  }, {
    params: t.Object({ id: t.String() }),
  });

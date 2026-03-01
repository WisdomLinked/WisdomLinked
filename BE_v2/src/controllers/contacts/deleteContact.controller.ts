import { Elysia, t } from "elysia";
import { Types } from "mongoose";
import { requireAdmin } from "../../middlewares/auth";
import { ContactedUsModel } from "../../models/ContactedUs";

type ContactIdParams = { id: string };

export const deleteContactController = new Elysia()
  .use(requireAdmin)
  .delete("/:id", async ({ params, set }) => {
    const { id } = params as ContactIdParams;

    if (!Types.ObjectId.isValid(id)) {
      set.status = 400;
      return { error: "Invalid ID" };
    }

    try {
      const doc = await ContactedUsModel.findByIdAndDelete(id);

      if (!doc) {
        set.status = 404;
        return { error: "Contact not found" };
      }

      return { message: "Contact deleted successfully" };
    } catch (error) {
      set.status = 500;
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: "Failed to delete contact", message };
    }
  }, {
    params: t.Object({ id: t.String() }),
  });

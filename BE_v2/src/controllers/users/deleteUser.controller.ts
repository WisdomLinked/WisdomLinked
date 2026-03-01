import { Elysia, t } from "elysia";
import { UserModel } from "../../models/User";
import { invalidateUserSessions } from "../../models/Session";
import { requireAdmin } from "../../middlewares/auth";

type UserIdParams = { id: string };

export const deleteUserController = new Elysia()
  .use(requireAdmin)
  .delete("/:id", async ({ params, set }) => {
    const { id } = params as UserIdParams;

    try {
      const user = await UserModel.findByIdAndDelete(id);

      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      // Invalidate all sessions for deleted user
      await invalidateUserSessions(id);

      return { message: "User deleted successfully" };
    } catch (error) {
      if (error instanceof Error) {
        set.status = 500;
        return { error: "Failed to delete user", message: error.message };
      }
      set.status = 500;
      return { error: "Failed to delete user", message: "Unknown error" };
    }
  }, {
    params: t.Object({
      id: t.String(),
    }),
  });


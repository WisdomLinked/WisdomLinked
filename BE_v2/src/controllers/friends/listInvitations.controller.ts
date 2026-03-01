import { Elysia, Context, t } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { FriendInvitationModel } from "../../models/FriendInvitation";
import { Types } from "mongoose";

type InvitationType = "sent" | "received" | "all";

export const listInvitationsController = new Elysia()
  .use(requireAuth)
  .get("/", async (context) => {
    const { user, set } = context as Context & { user: AuthUser };
    const { type = "all" } = context.query as { type?: string };

    try {
      const userId = new Types.ObjectId(user.userId);
      const invitationType: InvitationType =
        type === "sent" || type === "received" ? type : "all";

      let filter: Record<string, unknown>;

      if (invitationType === "sent") {
        filter = { senderId: userId, status: "pending" };
      } else if (invitationType === "received") {
        filter = { receiverId: userId, status: "pending" };
      } else {
        filter = {
          $or: [{ senderId: userId }, { receiverId: userId }],
          status: "pending",
        };
      }

      const invitations = await FriendInvitationModel.find(filter)
        .populate("senderId", "username email image")
        .populate("receiverId", "username email image")
        .lean()
        .exec();

      const mapped = invitations.map((inv) => ({
        id: inv._id.toString(),
        sender: inv.senderId,
        receiver: inv.receiverId,
        status: inv.status,
        createdAt: inv.createdAt,
      }));

      return { invitations: mapped };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set.status = 500;
      return { error: "Failed to list invitations", message };
    }
  }, {
    query: t.Object({
      type: t.Optional(
        t.Union([t.Literal("sent"), t.Literal("received"), t.Literal("all")])
      ),
    }),
  });

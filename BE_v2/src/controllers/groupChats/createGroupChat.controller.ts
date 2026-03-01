import { Context, Elysia, t } from "elysia";
import { Types } from "mongoose";
import { requireAuth, type AuthUser } from "../../middlewares/auth";
import { GroupChatModel, type GroupChatType } from "../../models/GroupChat";
import { UserModel } from "../../models/User";
import { UserRole } from "../../config/roles";

type CreateGroupChatBody = {
  name: string;
  description?: string;
  type: GroupChatType;
  start?: string;
  end?: string;
  duration?: number;
  price?: number;
  isOpenToAll?: boolean;
  keywords?: string[];
  services?: string[];
};

export const createGroupChatController = new Elysia()
  .use(requireAuth)
  .post(
    "/",
    async (context) => {
      const { user, set } = context as Context & { user: AuthUser };
      const body = context.body as CreateGroupChatBody;

      try {
        const { name, description, type, start, end, duration, price, isOpenToAll, keywords, services } = body;

        // Role validation: seminar and individual require expert role
        if (type === "seminar" || type === "individual") {
          if (user.role !== UserRole.EXPERT && user.role !== UserRole.ADMIN) {
            set.status = 403;
            return { error: "Only experts can create seminar or individual group chats" };
          }
        }

        const userObjectId = new Types.ObjectId(user.userId);

        const groupChat = await GroupChatModel.create({
          name,
          description,
          type,
          status: "pending",
          admin: userObjectId,
          createdBy: userObjectId,
          participants: [userObjectId],
          keywords: (keywords ?? []).filter(Boolean).map((k) => new Types.ObjectId(k)),
          services: (services ?? []).filter(Boolean).map((s) => new Types.ObjectId(s)),
          start: start ? new Date(start) : undefined,
          end: end ? new Date(end) : undefined,
          duration,
          price,
          isOpenToAll: isOpenToAll ?? false,
        });

        // Add groupChat to creator's groupChats array
        await UserModel.findByIdAndUpdate(userObjectId, {
          $addToSet: { groupChats: groupChat._id },
        });

        return { groupChat };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to create group chat", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to create group chat", message: "Unknown error" };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.String({ maxLength: 1000 })),
        type: t.Union([t.Literal("seminar"), t.Literal("individual"), t.Literal("community")]),
        start: t.Optional(t.String()),
        end: t.Optional(t.String()),
        duration: t.Optional(t.Number({ minimum: 1 })),
        price: t.Optional(t.Number({ minimum: 0 })),
        isOpenToAll: t.Optional(t.Boolean()),
        keywords: t.Optional(t.Array(t.String())),
        services: t.Optional(t.Array(t.String())),
      }),
    }
  );

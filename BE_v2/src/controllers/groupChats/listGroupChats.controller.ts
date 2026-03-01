import { Context, Elysia, t } from "elysia";
import { isValidObjectId, Types } from "mongoose";
import { requireAuth, type AuthUser } from "../../middlewares/auth";
import {
  GroupChatModel,
  type GroupChatStatus,
  type GroupChatType,
} from "../../models/GroupChat";

type GroupChatListFilter = {
  type?: GroupChatType;
  status?: GroupChatStatus;
  keywords?: Types.ObjectId;
  services?: Types.ObjectId;
  participants?: Types.ObjectId;
};

export const listGroupChatsController = new Elysia()
  .use(requireAuth)
  .get(
    "/",
    async (context) => {
      const { user, set } = context as Context & { user: AuthUser };
      const { type, status, keyword, service, mine, page = 1, limit = 20 } =
        context.query;

      try {
        const filter: GroupChatListFilter = {};

        if (type) {
          filter.type = type as GroupChatType;
        }

        if (status) {
          filter.status = status as GroupChatStatus;
        }

        if (keyword && isValidObjectId(keyword)) {
          filter.keywords = new Types.ObjectId(keyword);
        }

        if (service && isValidObjectId(service)) {
          filter.services = new Types.ObjectId(service);
        }

        if (mine === "true") {
          filter.participants = new Types.ObjectId(user.userId);
        }

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * limitNum;

        const [groupChats, total] = await Promise.all([
          GroupChatModel.find(filter)
            .populate("admin", "username image")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
          GroupChatModel.countDocuments(filter),
        ]);

        return {
          groupChats,
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
        };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to list group chats", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to list group chats", message: "Unknown error" };
      }
    },
    {
      query: t.Object({
        type: t.Optional(t.String()),
        status: t.Optional(t.String()),
        keyword: t.Optional(t.String()),
        service: t.Optional(t.String()),
        mine: t.Optional(t.Union([t.Literal("true"), t.Literal("false")])),
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      }),
    }
  );

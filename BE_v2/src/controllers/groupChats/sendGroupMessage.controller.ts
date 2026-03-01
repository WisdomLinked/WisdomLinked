import { Context, Elysia, t } from "elysia";
import { isValidObjectId, Types } from "mongoose";
import { requireAuth, type AuthUser } from "../../middlewares/auth";
import { GroupChatModel } from "../../models/GroupChat";
import { MessageModel, type MessageType } from "../../models/Message";

type GroupChatParams = { groupChatId: string };

type SendMessageBody = {
  content: string;
  type?: MessageType;
  fileUrl?: string;
};

export const sendGroupMessageController = new Elysia()
  .use(requireAuth)
  .post(
    "/",
    async (context) => {
      const { user, set } = context as Context & { user: AuthUser };
      const params = context.params as GroupChatParams;
      const body = context.body as SendMessageBody;
      const { groupChatId } = params;

      try {
        if (!isValidObjectId(groupChatId)) {
          set.status = 400;
          return { error: "Invalid group chat ID" };
        }

        const groupChat = await GroupChatModel.findById(groupChatId);

        if (!groupChat) {
          set.status = 404;
          return { error: "Group chat not found" };
        }

        // Caller must be a participant in this group chat
        const isParticipant = groupChat.participants.some((p) => p.toString() === user.userId);
        if (!isParticipant) {
          set.status = 403;
          return { error: "You are not a participant in this group chat" };
        }

        const authorObjectId = new Types.ObjectId(user.userId);

        const message = await MessageModel.create({
          author: authorObjectId,
          content: body.content,
          type: body.type ?? "text",
          groupChatId: groupChat._id,
          fileUrl: body.fileUrl,
          readBy: [authorObjectId],
        });

        return { message };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to send message", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to send message", message: "Unknown error" };
      }
    },
    {
      body: t.Object({
        content: t.String({ minLength: 1 }),
        type: t.Optional(t.Union([t.Literal("text"), t.Literal("file")])),
        fileUrl: t.Optional(t.String()),
      }),
      params: t.Object({
        groupChatId: t.String(),
      }),
    }
  );

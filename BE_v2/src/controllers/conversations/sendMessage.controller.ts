import { Elysia, Context, t } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { ConversationModel } from "../../models/Conversation";
import { MessageModel } from "../../models/Message";
import { Types } from "mongoose";

export const sendMessageController = new Elysia()
  .use(requireAuth)
  .post("/", async (context) => {
    const { user, set, params, body } = context as Context & {
      user: AuthUser;
      params: { conversationId: string };
      body: { content: string; type?: "text" | "file"; fileUrl?: string };
    };

    try {
      const { conversationId } = params;
      const { content, type = "text", fileUrl } = body;

      if (!Types.ObjectId.isValid(conversationId)) {
        set.status = 400;
        return { error: "Invalid conversation ID" };
      }

      const conversation = await ConversationModel.findById(conversationId).exec();
      if (!conversation) {
        set.status = 404;
        return { error: "Conversation not found" };
      }

      // Validate caller is a participant
      const isParticipant = conversation.participants.some(
        (p) => p.toString() === user.userId
      );
      if (!isParticipant) {
        set.status = 403;
        return { error: "You are not a participant in this conversation" };
      }

      // Create the message
      const message = await MessageModel.create({
        author: new Types.ObjectId(user.userId),
        content,
        type,
        conversationId: new Types.ObjectId(conversationId),
        ...(fileUrl !== undefined ? { fileUrl } : {}),
      });

      // Update conversation's lastMessage and touch updatedAt
      conversation.lastMessage = message._id;
      await conversation.save();

      return {
        message: {
          id: message._id.toString(),
          author: message.author.toString(),
          content: message.content,
          type: message.type,
          conversationId: conversationId,
          fileUrl: message.fileUrl,
          createdAt: message.createdAt,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set.status = 500;
      return { error: "Failed to send message", message };
    }
  }, {
    params: t.Object({
      conversationId: t.String(),
    }),
    body: t.Object({
      content: t.String({ minLength: 1 }),
      type: t.Optional(t.Union([t.Literal("text"), t.Literal("file")])),
      fileUrl: t.Optional(t.String()),
    }),
  });

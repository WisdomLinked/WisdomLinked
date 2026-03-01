import { Context, Elysia, t } from "elysia";
import { AuthUser, requireAuth } from "../../middlewares/auth";
import { ConversationModel } from "../../models/Conversation";
import { uploadChatFile } from "../../services/storage";
import { Types } from "mongoose";

export const uploadChatFileController = new Elysia()
  .use(requireAuth)
  .post(
    "/",
    async (context) => {
      const { user, set, params, body } = context as Context & {
        user: AuthUser;
        params: { conversationId: string };
        body: { file: File };
      };

      try {
        const { conversationId } = params;

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

        const file = body.file;
        const filename = file.name !== "" ? file.name : `file_${Date.now()}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        // Upload to S3 under chats/{conversationId}/{filename}
        const fileUrl = await uploadChatFile(conversationId, buffer, filename);

        return { fileUrl, filename };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        set.status = 500;
        return { error: "Failed to upload file", message };
      }
    },
    {
      params: t.Object({
        conversationId: t.String(),
      }),
      body: t.Object({
        file: t.File(),
      }),
    }
  );

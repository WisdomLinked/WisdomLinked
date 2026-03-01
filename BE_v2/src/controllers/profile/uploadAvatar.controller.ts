import { Elysia, t } from "elysia";
import { AuthUser, requireAuth } from "../../middlewares/auth";
import { UserModel } from "../../models/User";
import { resizeProfileImage, validateImage } from "../../services/image";
import { uploadProfileImage } from "../../services/storage";

export const uploadAvatarController = new Elysia()
  .use(requireAuth)
  .post(
    "/",
    async ({ body, set, ...context }) => {
      const { user } = context as { user: AuthUser };

      try {
        const file = body.file;

        const buffer = Buffer.from(await file.arrayBuffer());

        // Validate that it is an acceptable image
        const validation = await validateImage(buffer);
        if (!validation.valid) {
          set.status = 400;
          return {
            error:
              "Invalid image file. Must be JPEG, PNG, WebP, or GIF and under 10 MB",
          };
        }

        // Resize to 300×300 WebP
        const resized = await resizeProfileImage(buffer);

        // Upload to S3 under profiles/{userId}.webp
        const imageUrl = await uploadProfileImage(user.userId, resized, "webp");

        // Persist URL on the user document
        await UserModel.findByIdAndUpdate(user.userId, { image: imageUrl });

        return { imageUrl };
      } catch (error) {
        set.status = 500;
        return {
          error: "Failed to upload avatar",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    }
  );

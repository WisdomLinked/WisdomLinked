import { Elysia, t } from "elysia";
import { AuthUser, requireAuth } from "../../middlewares/auth";
import { UserModel } from "../../models/User";
import { UserRole } from "../../config/roles";
import { uploadResume } from "../../services/storage";

export const uploadResumeController = new Elysia()
  .use(requireAuth)
  .post(
    "/",
    async ({ body, set, ...context }) => {
      const { user } = context as { user: AuthUser };

      // Only experts (and admins) may upload a resume
      if (user.role !== UserRole.EXPERT && user.role !== UserRole.ADMIN) {
        set.status = 403;
        return { error: "Resume upload is only available for experts" };
      }

      try {
        const file = body.file;
        const filename = file.name ?? `resume_${user.userId}.pdf`;

        // Validate file type — only PDF accepted
        const ext = filename.split(".").pop()?.toLowerCase() ?? "";
        if (ext !== "pdf") {
          set.status = 400;
          return { error: "Only PDF files are accepted for resumes" };
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Upload to S3 under resumes/{userId}/{filename}
        const resumeUrl = await uploadResume(user.userId, buffer, filename);

        // Persist URL on the user document
        await UserModel.findByIdAndUpdate(user.userId, { resume: resumeUrl });

        return { resumeUrl };
      } catch (error) {
        set.status = 500;
        return {
          error: "Failed to upload resume",
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

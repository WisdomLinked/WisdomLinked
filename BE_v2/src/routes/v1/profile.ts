import { Elysia } from "elysia";
import {
  getProfileController,
  updateProfileController,
  uploadAvatarController,
  uploadResumeController,
} from "../../controllers/profile";

export const profileRoutes = new Elysia({ prefix: "/api/v1/profile" })
  .use(getProfileController)
  .use(updateProfileController)
  .use(new Elysia({ prefix: "/avatar" }).use(uploadAvatarController))
  .use(new Elysia({ prefix: "/resume" }).use(uploadResumeController));

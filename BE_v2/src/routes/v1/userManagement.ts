import { Elysia } from "elysia";
import {
  generatePasswordResetLinkController,
  getUserStatsController,
  resetUserPasswordController,
  searchUsersController,
  toggleUserStatusController,
} from "../../controllers/userManagement";

export const userManagementRoutes = new Elysia({ prefix: "/api/v1/user-management" })
  .use(new Elysia({ prefix: "/users" }).use(searchUsersController))
  .use(new Elysia({ prefix: "/stats" }).use(getUserStatsController))
  .use(new Elysia({ prefix: "/users/:id/toggle-status" }).use(toggleUserStatusController))
  .use(new Elysia({ prefix: "/users/:id/reset-password" }).use(resetUserPasswordController))
  .use(new Elysia({ prefix: "/users/:id/generate-reset-link" }).use(generatePasswordResetLinkController));

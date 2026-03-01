import { Elysia } from "elysia";
import {
  getUserSessionsController,
  revokeSessionController,
  revokeAllSessionsController,
  getSessionsForUserController,
  revokeUserSessionsController,
} from "../../controllers/sessions";

// All session routes - using wrapper pattern like auth routes
export const sessionRoutes = new Elysia({ prefix: "/api/v1/sessions" })
  .use(new Elysia({ prefix: "/my-sessions" }).use(getUserSessionsController))
  .use(new Elysia({ prefix: "/user/:userId" }).use(getSessionsForUserController))
  .use(new Elysia({ prefix: "/user/:userId" }).use(revokeUserSessionsController))
  .use(revokeAllSessionsController)
  .use(new Elysia({ prefix: "/:sessionId" }).use(revokeSessionController));

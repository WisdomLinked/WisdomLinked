import { Elysia } from "elysia";
import { listFeedbacksController } from "../../controllers/feedback";

export const feedbackRoutes = new Elysia({ prefix: "/api/v1/feedback" })
  // GET /api/v1/feedback — list completed events with their feedbacks
  .use(listFeedbacksController);

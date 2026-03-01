import { Elysia } from "elysia";
import {
  createEventController,
  listEventsController,
  getCalendarController,
  getEventController,
  acceptEventController,
  declineEventController,
  cancelEventController,
  completeEventController,
  submitFeedbackController,
} from "../../controllers/events";

/**
 * Events API Routes
 *
 * POST   /api/v1/events                    — create event (expert only)
 * GET    /api/v1/events                    — list events (paginated, filterable)
 * GET    /api/v1/events/calendar           — calendar view (date range)
 * GET    /api/v1/events/:eventId           — get single event
 * PUT    /api/v1/events/:eventId/accept    — accept event
 * PUT    /api/v1/events/:eventId/decline   — decline event
 * PUT    /api/v1/events/:eventId/cancel    — cancel event
 * PUT    /api/v1/events/:eventId/complete  — complete event (expert only)
 * POST   /api/v1/events/:eventId/feedback  — submit feedback (customer only)
 *
 * All routes require authentication via requireAuth middleware (applied in each controller).
 */
export const eventRoutes = new Elysia({ prefix: "/api/v1/events" })
  // Root-level: create and list
  .use(createEventController)
  .use(listEventsController)
  // /calendar must come before /:eventId to prevent "calendar" matching as an eventId
  .use(new Elysia({ prefix: "/calendar" }).use(getCalendarController))
  // Single event detail
  .use(new Elysia({ prefix: "/:eventId" }).use(getEventController))
  // State machine transitions
  .use(new Elysia({ prefix: "/:eventId/accept" }).use(acceptEventController))
  .use(new Elysia({ prefix: "/:eventId/decline" }).use(declineEventController))
  .use(new Elysia({ prefix: "/:eventId/cancel" }).use(cancelEventController))
  .use(
    new Elysia({ prefix: "/:eventId/complete" }).use(completeEventController)
  )
  // Feedback
  .use(
    new Elysia({ prefix: "/:eventId/feedback" }).use(submitFeedbackController)
  );

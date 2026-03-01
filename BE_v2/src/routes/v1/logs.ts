import { Elysia } from "elysia";
import { clearLogsController, getLogsController } from "../../controllers/logs";

export const logsRoutes = new Elysia({ prefix: "/api/v1/logs" })
  .use(getLogsController)
  .use(clearLogsController);

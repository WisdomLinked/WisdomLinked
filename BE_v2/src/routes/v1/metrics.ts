import { Elysia } from "elysia";
import {
  clearMetricsController,
  getMetricsController,
  getMetricsSummaryController,
} from "../../controllers/metrics";

export const metricsRoutes = new Elysia({ prefix: "/api/v1/metrics" })
  .use(getMetricsController)
  .use(new Elysia({ prefix: "/summary" }).use(getMetricsSummaryController))
  .use(clearMetricsController);

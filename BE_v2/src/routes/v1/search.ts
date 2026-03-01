import { Elysia } from "elysia";
import {
  searchExpertsController,
  searchCustomersController,
} from "../../controllers/search";

export const searchRoutes = new Elysia({ prefix: "/api/v1/search" })
  .use(new Elysia({ prefix: "/experts" }).use(searchExpertsController))
  .use(new Elysia({ prefix: "/customers" }).use(searchCustomersController));

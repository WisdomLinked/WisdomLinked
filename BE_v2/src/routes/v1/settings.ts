import { Elysia } from "elysia";
import {
  getSettingsController,
  updateSettingsController,
  getPublicSettingsController,
} from "../../controllers/settings";

export const settingsRoutes = new Elysia({ prefix: "/api/v1/settings" })
  .use(new Elysia({ prefix: "/public" }).use(getPublicSettingsController))
  .use(getSettingsController)
  .use(updateSettingsController);

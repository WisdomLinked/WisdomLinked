import { Elysia } from "elysia";
import { getDiscordAuthUrlController, handleDiscordCallbackController } from "../../controllers/oauth";

export const oauthRoutes = new Elysia({ prefix: "/api/v1/oauth" })
  .use(new Elysia({ prefix: "/discord" }).use(getDiscordAuthUrlController))
  .use(new Elysia({ prefix: "/discord/callback" }).use(handleDiscordCallbackController));

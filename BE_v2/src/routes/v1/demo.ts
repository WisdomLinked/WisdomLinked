import { Elysia } from "elysia";

import { generateDemoTokenController } from "../../controllers/demo";

export const demoRoutes = new Elysia({ prefix: "/api/v1/demo" }).use(generateDemoTokenController);

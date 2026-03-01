import { Elysia } from "elysia";
import { authRoutes } from "./v1/auth";
import { logsRoutes } from "./v1/logs";
import { metricsRoutes } from "./v1/metrics";
import { userRoutes } from "./v1/users";
import { userManagementRoutes } from "./v1/userManagement";
import { settingsRoutes } from "./v1/settings";
import { oauthRoutes } from "./v1/oauth";
import { sessionRoutes } from "./v1/sessions";
import { paymentRoutes } from "./v1/payment";
import { profileRoutes } from "./v1/profile";
import { searchRoutes } from "./v1/search";
import { eventRoutes } from "./v1/events";
import { friendRoutes } from "./v1/friends";
import { conversationRoutes } from "./v1/conversations";
import { groupChatRoutes } from "./v1/groupChats";

export const routes = new Elysia()
  // Auth routes (public + protected)
  .use(authRoutes)
  // OAuth routes
  .use(oauthRoutes)
  // Payment routes (public + protected + admin)
  .use(paymentRoutes)
  // Session routes (user + admin combined)
  .use(sessionRoutes)
  // Profile routes (user)
  .use(profileRoutes)
  // Search routes (public)
  .use(searchRoutes)
  // Events routes (protected)
  .use(eventRoutes)
  // Friends routes (protected)
  .use(friendRoutes)
  // Direct messaging routes (protected)
  .use(conversationRoutes)
  // Group chat routes (protected)
  .use(groupChatRoutes)
  // Admin routes
  .use(userRoutes)
  .use(logsRoutes)
  .use(metricsRoutes)
  .use(userManagementRoutes)
  .use(settingsRoutes);

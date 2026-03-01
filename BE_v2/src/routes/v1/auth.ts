import { Elysia } from "elysia";
import {
  registerController,
  loginController,
  getCurrentUserController,
  logoutController,
  requestOtpController,
  verifyOtpController,
  requestEmailVerificationController,
  confirmEmailVerificationController,
  forgotPasswordController,
  resetPasswordController,
} from "../../controllers/auth";

export const authRoutes = new Elysia({ prefix: "/api/v1/auth" })
  // Standard auth
  .use(new Elysia({ prefix: "/register" }).use(registerController))
  .use(new Elysia({ prefix: "/login" }).use(loginController))
  .use(new Elysia({ prefix: "/me" }).use(getCurrentUserController))
  .use(new Elysia({ prefix: "/logout" }).use(logoutController))
  // OTP login
  .use(new Elysia({ prefix: "/otp/request" }).use(requestOtpController))
  .use(new Elysia({ prefix: "/otp/verify" }).use(verifyOtpController))
  // Email verification registration
  .use(
    new Elysia({ prefix: "/email-verification/request" }).use(
      requestEmailVerificationController
    )
  )
  .use(
    new Elysia({ prefix: "/email-verification/confirm" }).use(
      confirmEmailVerificationController
    )
  )
  // Password reset
  .use(new Elysia({ prefix: "/forgot-password" }).use(forgotPasswordController))
  .use(new Elysia({ prefix: "/reset-password" }).use(resetPasswordController));


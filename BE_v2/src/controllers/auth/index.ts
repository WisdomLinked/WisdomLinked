/**
 * Auth Controllers Index
 * Exports all individual auth controllers for use in routes
 */
export { registerController } from "./register.controller";
export { loginController } from "./login.controller";
export { getCurrentUserController } from "./getCurrentUser.controller";
export { logoutController } from "./logout.controller";
export { requestOtpController } from "./requestOtp.controller";
export { verifyOtpController } from "./verifyOtp.controller";
export { requestEmailVerificationController } from "./requestEmailVerification.controller";
export { confirmEmailVerificationController } from "./confirmEmailVerification.controller";
export { forgotPasswordController } from "./forgotPassword.controller";
export { resetPasswordController } from "./resetPassword.controller";


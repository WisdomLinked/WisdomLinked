/** User-visible auth error strings returned as `{ error: "..." }`. */

export const AUTH_INVALID_CREDENTIALS = 'Invalid credentials. Please try again.';

export const AUTH_USER_BLOCKED = 'Your account is blocked. Contact support for help.';

export const AUTH_EMAIL_MISSING = 'Email is required.';

export const AUTH_EMAIL_NOT_FOUND = 'No account found with that email.';

export const AUTH_OAUTH_PASSWORD_RESET_UNAVAILABLE = (provider: string) =>
    `This account uses ${provider} sign-in. Password reset is not available.`;

export const AUTH_OAUTH_LOGIN_REQUIRED = (provider: string) =>
    `This account was created using ${provider} sign-in. Please use ${provider} to log in.`;

export const AUTH_LOGIN_REQUEST_EXPIRED =
    'Login request not found or expired. Please request a new code.';

export const AUTH_INCORRECT_CODE = 'Incorrect verification code. Please try again.';

export const AUTH_CODE_EXPIRED = 'Verification code expired. Please request a new code.';

export const AUTH_PASSWORD_RESET_EXPIRED =
    'Your password reset request has expired. Please start again.';

export const AUTH_PASSWORD_RESET_INVALID_CODE = 'Invalid code. Please try again.';

export const AUTH_PASSWORD_WEAK = 'Password does not meet strong requirements.';

export const AUTH_PASSWORD_SAME_AS_OLD =
    'New password cannot be the same as your current password.';

export const AUTH_REGISTRATION_NOT_FOUND = 'Registration request not found. Please register again.';

export const AUTH_VERIFICATION_EXPIRED = 'Verification link has expired. Request a new one.';

export const AUTH_INVALID_VERIFICATION_CODE = 'Invalid verification code. Please try again.';

export const AUTH_USER_NOT_FOUND = 'User not found.';

export const AUTH_PROFILE_PHOTO_REQUIRED = 'Profile photo is required.';

export const AUTH_PROFILE_PHOTO_UPLOAD_FAILED = 'Profile photo upload failed. Please try again.';

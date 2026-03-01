import { apiClient } from "./client";

export type UserRole = "customer" | "expert" | "admin";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface CurrentUserResponse {
  user: AuthUser;
}

export interface RequestOtpData {
  email: string;
}

export interface VerifyOtpData {
  email: string;
  code: string;
}

export interface RequestEmailVerificationData {
  username: string;
  email: string;
  password: string;
  role: "customer" | "expert";
}

export interface ConfirmEmailVerificationData {
  email: string;
  code: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  email: string;
  code: string;
  newPassword: string;
}

export const authApi = {
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiClient.post("/api/v1/auth/register", data);
    return response.data;
  },

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post("/api/v1/auth/login", credentials);
    return response.data;
  },

  async logout(): Promise<void> {
    await apiClient.post("/api/v1/auth/logout");
  },

  async getCurrentUser(): Promise<CurrentUserResponse> {
    const response = await apiClient.get("/api/v1/auth/me");
    return response.data;
  },

  // OTP login
  async requestOtp(data: RequestOtpData): Promise<{ message: string }> {
    const response = await apiClient.post("/api/v1/auth/otp/request", data);
    return response.data;
  },

  async verifyOtp(data: VerifyOtpData): Promise<AuthResponse> {
    const response = await apiClient.post("/api/v1/auth/otp/verify", data);
    return response.data;
  },

  // Email verification registration
  async requestEmailVerification(
    data: RequestEmailVerificationData
  ): Promise<{ message: string }> {
    const response = await apiClient.post(
      "/api/v1/auth/email-verification/request",
      data
    );
    return response.data;
  },

  async confirmEmailVerification(
    data: ConfirmEmailVerificationData
  ): Promise<AuthResponse> {
    const response = await apiClient.post(
      "/api/v1/auth/email-verification/confirm",
      data
    );
    return response.data;
  },

  // Password reset
  async forgotPassword(data: ForgotPasswordData): Promise<{ message: string }> {
    const response = await apiClient.post("/api/v1/auth/forgot-password", data);
    return response.data;
  },

  async resetPassword(data: ResetPasswordData): Promise<{ message: string }> {
    const response = await apiClient.post("/api/v1/auth/reset-password", data);
    return response.data;
  },

  // Discord OAuth
  async getDiscordAuthUrl(): Promise<{ authUrl: string }> {
    const response = await apiClient.get("/api/v1/oauth/discord");
    return response.data;
  },

  async handleDiscordCallback(code: string): Promise<AuthResponse> {
    const response = await apiClient.get(`/api/v1/oauth/discord/callback?code=${code}`);
    return response.data;
  },
};


import { apiClient } from "./client";

export interface UserProfile {
  _id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  status: "review" | "active" | "blocked";
  phoneNumber?: string;
  country?: string;
  state?: string;
  city?: string;
  timeZone?: string;
  image?: string;
  // Expert-specific
  title?: string;
  description?: string;
  resume?: string;
  timeSlots: number[];
  dailyTimeSlots: number[];
  price: number[];
  rating: number;
  keywords: Array<{ _id: string; name?: string }>;
  services: Array<{ _id: string; name?: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface GetProfileResponse {
  user: UserProfile;
}

export interface UpdateProfileData {
  phoneNumber?: string;
  country?: string;
  state?: string;
  city?: string;
  timeZone?: string;
  // Expert-only
  title?: string;
  description?: string;
  timeSlots?: number[];
  dailyTimeSlots?: number[];
  price?: number[];
  keywords?: string[];
  services?: string[];
}

export interface UpdateProfileResponse {
  user: UserProfile;
}

export interface UploadAvatarResponse {
  imageUrl: string;
}

export interface UploadResumeResponse {
  resumeUrl: string;
}

export const profileApi = {
  async getProfile(): Promise<GetProfileResponse> {
    const response = await apiClient.get("/api/v1/profile");
    return response.data;
  },

  async updateProfile(data: UpdateProfileData): Promise<UpdateProfileResponse> {
    const response = await apiClient.put("/api/v1/profile", data);
    return response.data;
  },

  async uploadAvatar(file: File): Promise<UploadAvatarResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post("/api/v1/profile/avatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  async uploadResume(file: File): Promise<UploadResumeResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post("/api/v1/profile/resume", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
};

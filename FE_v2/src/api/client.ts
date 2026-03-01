import axios from "axios";
import { getDefaultStore } from "jotai";
import { tokenAtom } from "@/atoms/authAtoms";
import { getFrontendEnvironmentConfig } from "@/config/env";

const { apiBaseUrl: API_BASE_URL } = getFrontendEnvironmentConfig();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Get the Jotai store to read atoms
const store = getDefaultStore();

// Request interceptor to add token
apiClient.interceptors.request.use(
  (config) => {
    // Read token from Jotai atom (which syncs with localStorage)
    const token = store.get(tokenAtom);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // Handle unauthorized errors
      if (status === 401) {
        // Clear token from atom (which syncs with localStorage)
        store.set(tokenAtom, null);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }

      // Show toast notification if available
      if (window.toast) {
        window.toast({
          title: "Error",
          description: data.error || data.message || "An error occurred",
          variant: "destructive",
        });
      }
    } else if (error.request) {
      // Network error
      if (window.toast) {
        window.toast({
          title: "Network Error",
          description: "Unable to connect to the server",
          variant: "destructive",
        });
      }
    }

    return Promise.reject(error);
  }
);

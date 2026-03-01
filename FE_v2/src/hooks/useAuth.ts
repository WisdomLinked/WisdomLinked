import { useAtom } from "jotai";
import { isLoadingAuthAtom, tokenAtom, userAtom, sessionsAtom } from "@/atoms/authAtoms";
import { authApi, LoginCredentials, RegisterData } from "@/api/authApi";
import { dashboardPathForRole } from "@/utils/dashboardPath";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export type AuthCheckResult = "authenticated" | "unauthenticated" | "retryable_error";

function isAuthFailure(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  return error.response?.status === 401;
}

export function useAuth() {
  const [user, setUser] = useAtom(userAtom);
  const [token, setToken] = useAtom(tokenAtom);
  const [, setSessions] = useAtom(sessionsAtom);
  const [isLoading, setIsLoading] = useAtom(isLoadingAuthAtom);
  const navigate = useNavigate();

  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      const response = await authApi.login(credentials);
      
      setToken(response.token); // Automatically syncs to localStorage
      setUser(response.user);

      if (window.toast) {
        window.toast({
          title: "Success",
          description: "Logged in successfully",
        });
      }

      navigate(dashboardPathForRole(response.user.role));
    } catch (error: unknown) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    try {
      setIsLoading(true);
      const response = await authApi.register(data);
      
      setToken(response.token); // Automatically syncs to localStorage
      setUser(response.user);

      if (window.toast) {
        window.toast({
          title: "Success",
          description: "Account created successfully",
        });
      }

      navigate(dashboardPathForRole(response.user.role));
    } catch (error: unknown) {
      console.error("Register error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setToken(null); // Automatically clears from localStorage
      setUser(null);
      setSessions([]); // Automatically clears from localStorage
      navigate("/login");
    }
  };

  const checkAuth = async () => {
    // Token is automatically loaded from localStorage via atomWithStorage
    if (!token) {
      setUser(null);
      return "unauthenticated" as AuthCheckResult;
    }

    try {
      setIsLoading(true);
      const response = await authApi.getCurrentUser();
      setUser(response.user);
      return "authenticated" as AuthCheckResult;
    } catch (error) {
      console.error("Auth check error:", error);

      // Only clear persisted auth state for explicit auth failures.
      if (isAuthFailure(error)) {
        setToken(null); // Automatically clears from localStorage
        setUser(null);
        setSessions([]); // Automatically clears from localStorage
        return "unauthenticated" as AuthCheckResult;
      }

      // Keep auth state intact for transient errors (e.g., backend restart during development).
      return "retryable_error" as AuthCheckResult;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    checkAuth,
  };
}


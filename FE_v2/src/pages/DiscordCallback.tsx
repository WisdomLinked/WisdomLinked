import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "@/api/authApi";
import { useSetAtom } from "jotai";
import { tokenAtom, userAtom } from "@/atoms/authAtoms";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export function DiscordCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setToken = useSetAtom(tokenAtom);
  const setUser = useSetAtom(userAtom);
  const hasProcessed = useRef(false);

  // Derive error state from URL params
  const errorParam = searchParams.get("error");
  const code = searchParams.get("code");
  const error = errorParam
    ? "Discord authentication was cancelled or failed"
    : !code
      ? "No authorization code received"
      : null;

  const handleCallback = useCallback(async (code: string) => {
    try {
      const response = await authApi.handleDiscordCallback(code);

      // Store token and user data
      setToken(response.token);
      setUser(response.user);

      // Redirect to dashboard
      navigate("/dashboard");
    } catch (error) {
      console.error("Discord callback error:", error);

      if (window.toast) {
        window.toast({
          title: "Authentication Failed",
          description: "Failed to complete Discord login. Please try again.",
          variant: "destructive",
        });
      }

      setTimeout(() => navigate("/login"), 3000);
    }
  }, [navigate, setToken, setUser]);

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    // If there's an error or no code, redirect to login
    if (errorParam || !code) {
      setTimeout(() => navigate("/login"), 3000);
      return;
    }

    // Process the callback
    handleCallback(code);
  }, [searchParams, navigate, handleCallback]);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto text-center">
        {error ? (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-red-600">Authentication Failed</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirecting to login page...</p>
          </div>
        ) : (
          <div>
            <LoadingSpinner />
            <h2 className="text-2xl font-bold mb-4 mt-4">Completing Discord Login</h2>
            <p className="text-gray-600">Please wait while we authenticate you...</p>
          </div>
        )}
      </div>
    </div>
  );
}

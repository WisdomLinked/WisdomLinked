import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";
import { isAuthenticatedAtom, userAtom } from "@/atoms/authAtoms";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "./LoadingSpinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const user = useAtomValue(userAtom);
  const { checkAuth } = useAuth();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const hasCheckedRef = useRef(false);
  const retryTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let isActive = true;

    const verifyAuth = async () => {
      if (hasCheckedRef.current) return;
      if (user) {
        hasCheckedRef.current = true;
        setIsChecking(false);
        return;
      }

      const result = await checkAuth();
      if (!isActive) return;

      if (result === "retryable_error") {
        retryTimeoutRef.current = window.setTimeout(() => {
          verifyAuth();
        }, 1000);
        return;
      }

      hasCheckedRef.current = true;
      setIsChecking(false);
    };

    verifyAuth();

    return () => {
      isActive = false;
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [user, checkAuth]);

  if (isChecking) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

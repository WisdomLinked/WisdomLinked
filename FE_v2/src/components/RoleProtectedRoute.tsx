import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";
import { userAtom } from "@/atoms/authAtoms";
import type { UserRole } from "@/atoms/authAtoms";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "./LoadingSpinner";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ReadonlyArray<UserRole>;
}

function roleDashboard(role: UserRole): string {
  if (role === "customer") return "/dashboard/customer";
  if (role === "expert") return "/dashboard/expert";
  return "/admin";
}

export function RoleProtectedRoute({ children, allowedRoles }: RoleProtectedRouteProps) {
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

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={roleDashboard(user.role)} replace />;
  }

  return <>{children}</>;
}

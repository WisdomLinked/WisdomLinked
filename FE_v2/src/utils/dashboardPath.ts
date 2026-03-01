import type { UserRole } from "@/api/authApi";

/**
 * Returns the canonical dashboard path for a given user role.
 * Single source of truth — import this everywhere instead of duplicating the mapping.
 */
export function dashboardPathForRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "expert":
      return "/dashboard/expert";
    case "customer":
      return "/dashboard/customer";
  }
}

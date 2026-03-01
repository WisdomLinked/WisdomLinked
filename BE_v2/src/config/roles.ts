export enum UserRole {
  CUSTOMER = "customer",
  EXPERT = "expert",
  ADMIN = "admin",
}

export const ROLES = {
  CUSTOMER: UserRole.CUSTOMER,
  EXPERT: UserRole.EXPERT,
  ADMIN: UserRole.ADMIN,
} as const;


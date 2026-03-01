import {
  Calendar,
  CalendarCheck,
  CreditCard,
  Home,
  MessageSquare,
  Search,
  Settings,
  User,
  Users,
  Video,
} from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import type { NavItem } from "./DashboardLayout";

const customerNavItems: NavItem[] = [
  { to: "/dashboard/customer", label: "Home", icon: Home, exact: true },
  { to: "/dashboard/customer/profile", label: "Profile", icon: User },
  { to: "/dashboard/customer/search", label: "Search Experts", icon: Search },
  { to: "/dashboard/customer/seminars", label: "Seminars", icon: Video },
  { to: "/dashboard/customer/calendar", label: "Calendar", icon: Calendar },
  { to: "/dashboard/customer/events", label: "My Events", icon: CalendarCheck },
  { to: "/dashboard/customer/payments", label: "Payments", icon: CreditCard },
  { to: "/dashboard/messenger", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/friends", label: "Friends", icon: Users },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function CustomerLayout() {
  return <DashboardLayout title="Customer Portal" navItems={customerNavItems} />;
}

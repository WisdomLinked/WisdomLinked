import {
  Calendar,
  CalendarCheck,
  Clock,
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

const expertNavItems: NavItem[] = [
  { to: "/dashboard/expert", label: "Home", icon: Home, exact: true },
  { to: "/dashboard/expert/profile", label: "Profile", icon: User },
  { to: "/dashboard/expert/availability", label: "Availability", icon: Clock },
  { to: "/dashboard/expert/seminars", label: "Seminars", icon: Video },
  { to: "/dashboard/expert/calendar", label: "Calendar", icon: Calendar },
  { to: "/dashboard/expert/events", label: "My Events", icon: CalendarCheck },
  { to: "/dashboard/expert/search", label: "Discover", icon: Search },
  { to: "/dashboard/messenger", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/friends", label: "Friends", icon: Users },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function ExpertLayout() {
  return <DashboardLayout title="Expert Portal" navItems={expertNavItems} />;
}

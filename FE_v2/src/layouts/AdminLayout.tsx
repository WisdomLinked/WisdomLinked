import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Bot,
  CreditCard,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Settings,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const adminNavItems: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/chats", label: "Chats", icon: MessageSquare },
  { to: "/admin/chatbot", label: "Chatbot", icon: Bot },
  { to: "/admin/contacts", label: "Contacts", icon: Mail },
  { to: "/admin/feedbacks", label: "Feedbacks", icon: Star },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminLayout() {
  const location = useLocation();

  const isActive = (item: NavItem): boolean => {
    if (item.exact === true) {
      return location.pathname === item.to;
    }
    return location.pathname.startsWith(item.to);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-6">
        <aside className="w-64 flex-shrink-0">
          <div className="sticky top-8">
            <h2 className="text-lg font-semibold mb-4 px-3">Admin Panel</h2>
            <nav className="space-y-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);

                return (
                  <Link key={item.to} to={item.to}>
                    <Button
                      variant={active ? "secondary" : "ghost"}
                      className={cn("w-full justify-start", active && "bg-secondary")}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}


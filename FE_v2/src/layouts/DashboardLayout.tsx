import { Link, Outlet, useLocation } from "react-router-dom";
import { useAtomValue, useAtom } from "jotai";
import { userAtom } from "@/atoms/authAtoms";
import { sidebarOpenAtom } from "@/atoms/appAtoms";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface DashboardLayoutProps {
  title: string;
  navItems: NavItem[];
}

export function DashboardLayout({ title, navItems }: DashboardLayoutProps) {
  const user = useAtomValue(userAtom);
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom);
  const { logout } = useAuth();
  const location = useLocation();

  const isActive = (item: NavItem): boolean => {
    if (item.exact === true) {
      return location.pathname === item.to;
    }
    return location.pathname.startsWith(item.to);
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r bg-card transition-all duration-200 flex-shrink-0",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b">
          {sidebarOpen && (
            <Link to="/" className="font-bold text-lg truncate">
              WisdomLinked
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Dashboard label */}
        {sidebarOpen && (
          <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
              <Link key={item.to} to={item.to}>
                <Button
                  variant={active ? "secondary" : "ghost"}
                  className={cn(
                    "w-full",
                    sidebarOpen ? "justify-start" : "justify-center px-0"
                  )}
                >
                  <Icon className={cn("h-4 w-4 flex-shrink-0", sidebarOpen && "mr-2")} />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer — User info + logout */}
        <div className="border-t p-2">
          {sidebarOpen && user && (
            <div className="px-2 py-2 mb-1">
              <div className="text-sm font-medium truncate">{user.username}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
          )}
          <Button
            variant="ghost"
            className={cn(
              "w-full",
              sidebarOpen ? "justify-start" : "justify-center px-0"
            )}
            onClick={() => {
              logout().catch(console.error);
            }}
          >
            <LogOut className={cn("h-4 w-4 flex-shrink-0", sidebarOpen && "mr-2")} />
            {sidebarOpen && "Logout"}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b bg-card flex items-center px-6 gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <span className="font-semibold">{title}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

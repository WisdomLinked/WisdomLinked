import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";
import { isAdminAtom, userAtom } from "@/atoms/authAtoms";
import type { UserRole } from "@/atoms/authAtoms";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChevronDown,
  Home,
  LayoutDashboard,
  LogOut,
  Settings as SettingsIcon,
  Shield,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
}

function dashboardPathForRole(role: UserRole): string {
  if (role === "expert") return "/dashboard/expert";
  if (role === "admin") return "/admin";
  return "/dashboard/customer";
}

export function MainLayout({ children }: MainLayoutProps) {
  const user = useAtomValue(userAtom);
  const isAdmin = useAtomValue(isAdminAtom);
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const dashboardPath = user ? dashboardPathForRole(user.role) : "/login";

  const primaryLinks = [
    { to: "/", label: "Home", icon: Home },
    { to: dashboardPath, label: "Dashboard", icon: LayoutDashboard },
    { to: "/dashboard/settings", label: "Account Settings", icon: SettingsIcon },
  ];

  const adminLinks = [
    { to: "/admin", label: "Admin Overview", icon: Shield },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/settings", label: "System Settings", icon: SettingsIcon },
  ];

  const isRouteActive = (to: string) => {
    if (to === "/") return location.pathname === "/";
    if (to === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold">
                WisdomLinked
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" className="h-9 px-3">
                        <User className="h-4 w-4 mr-2" />
                        <span className="max-w-36 truncate">{user.username}</span>
                        {isAdmin && (
                          <span className="ml-2 px-2 py-0.5 text-[10px] rounded bg-primary/10 text-primary">
                            Admin
                          </span>
                        )}
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-0">
                      <div className="px-4 py-3 border-b">
                        <div className="text-sm font-medium">{user.username}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>

                      <div className="p-2">
                        <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Directory
                        </div>
                        <nav className="space-y-1">
                          {primaryLinks.map((item) => {
                            const Icon = item.icon;
                            const active = isRouteActive(item.to);
                            return (
                              <Link
                                key={item.to}
                                to={item.to}
                                onClick={() => setMenuOpen(false)}
                                className={cn(
                                  "flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent",
                                  active && "bg-accent font-medium"
                                )}
                              >
                                <Icon className="h-4 w-4" />
                                {item.label}
                              </Link>
                            );
                          })}
                        </nav>
                      </div>

                      {isAdmin && (
                        <div className="p-2 border-t">
                          <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Admin
                          </div>
                          <nav className="space-y-1">
                            {adminLinks.map((item) => {
                              const Icon = item.icon;
                              const active = isRouteActive(item.to);
                              return (
                                <Link
                                  key={item.to}
                                  to={item.to}
                                  onClick={() => setMenuOpen(false)}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent",
                                    active && "bg-accent font-medium"
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                  {item.label}
                                </Link>
                              );
                            })}
                          </nav>
                        </div>
                      )}

                      <div className="p-2 border-t">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={async () => {
                            setMenuOpen(false);
                            await logout();
                          }}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Logout
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" size="sm">
                      Login
                    </Button>
                  </Link>
                  <Link to="/register/customer">
                    <Button size="sm">Register</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          WisdomLinked — Connecting Customers with Experts
        </div>
      </footer>
    </div>
  );
}


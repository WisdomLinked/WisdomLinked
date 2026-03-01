import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Lock, Monitor, Receipt, SlidersHorizontal, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function Settings() {
  const location = useLocation();
  const navSections = [
    {
      title: "Account Settings",
      links: [
        {
          to: "/settings/account/profile",
          label: "Profile",
          description: "Identity and account details",
          icon: User,
        },
        {
          to: "/settings/account/preferences",
          label: "Preferences",
          description: "Display and app preferences",
          icon: SlidersHorizontal,
        },
      ],
    },
    {
      title: "Security Settings",
      links: [
        {
          to: "/settings/security/password",
          label: "Password",
          description: "Credentials and authentication",
          icon: Lock,
        },
        {
          to: "/settings/security/sessions",
          label: "Sessions",
          description: "Active devices and session control",
          icon: Monitor,
        },
      ],
    },
    {
      title: "Billing Settings",
      links: [
        {
          to: "/settings/billing/subscription",
          label: "Subscription",
          description: "Current plan and status",
          icon: CreditCard,
        },
        {
          to: "/settings/billing/plans",
          label: "Plans & Pricing",
          description: "Compare and manage plans",
          icon: Receipt,
        },
      ],
    },
  ];

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account, security, and billing preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <aside className="md:w-80 md:shrink-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Settings Directory</CardTitle>
              <CardDescription>Choose a section to manage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {navSections.map((section) => (
                <div key={section.title} className="space-y-1">
                  <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </div>
                  {section.links.map((item) => {
                    const Icon = item.icon;
                    const active = location.pathname === item.to;

                    return (
                      <Link key={item.to} to={item.to}>
                        <Button
                          variant="ghost"
                          className={cn(
                            "h-auto w-full justify-start px-3 py-2.5",
                            active && "bg-accent text-accent-foreground"
                          )}
                        >
                          <div className="flex items-start gap-3 text-left">
                            <Icon className="h-4 w-4 mt-0.5" />
                            <div>
                              <div className="font-medium">{item.label}</div>
                              <div className="text-xs text-muted-foreground">{item.description}</div>
                            </div>
                          </div>
                        </Button>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>

        <section className="flex-1 min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}


import { useEffect, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, CreditCard, Search, CalendarCheck } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { eventsApi, type EventListItem } from "@/api/eventsApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──────────────────────────────────────────────────────────────────

type UpcomingState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; events: EventListItem[] };

type ActivityState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; events: EventListItem[] };

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "Date TBD";
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "accepted") return "default";
  if (status === "completed") return "secondary";
  if (status === "cancelled" || status === "declined") return "destructive";
  return "outline";
}

// ── Quick Actions ──────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    label: "Search Experts",
    to: "/dashboard/customer/search",
    icon: Search,
    description: "Find the right expert for your needs",
  },
  {
    label: "My Calendar",
    to: "/dashboard/customer/calendar",
    icon: Calendar,
    description: "View your scheduled sessions",
  },
  {
    label: "Payments",
    to: "/dashboard/customer/payments",
    icon: CreditCard,
    description: "Manage billing and subscriptions",
  },
] as const;

// ── Component ──────────────────────────────────────────────────────────────

export default function CustomerHome() {
  const { user } = useAuth();
  const [upcomingState, setUpcomingState] = useState<UpcomingState>({
    status: "loading",
  });
  const [activityState, setActivityState] = useState<ActivityState>({
    status: "loading",
  });

  // Load functions use .then/.catch so no synchronous setState happens
  // before an async boundary — avoids react-hooks/set-state-in-effect.
  const loadUpcoming = useCallback(() => {
    eventsApi
      .listEvents({ role: "as-customer", status: "accepted", limit: 5 })
      .then((data) => {
        setUpcomingState({ status: "ready", events: data.events });
      })
      .catch(() => {
        setUpcomingState({
          status: "error",
          message: "Failed to load upcoming events.",
        });
      });
  }, []);

  const loadActivity = useCallback(() => {
    eventsApi
      .listEvents({ role: "as-customer", limit: 5 })
      .then((data) => {
        setActivityState({ status: "ready", events: data.events });
      })
      .catch(() => {
        setActivityState({ status: "error" });
      });
  }, []);

  useEffect(() => {
    loadUpcoming();
    loadActivity();
  }, [loadUpcoming, loadActivity]);

  return (
    <div className="space-y-8 p-6">
      {/* Welcome Banner */}
      <div className="rounded-xl border bg-card p-6 shadow">
        <h1 className="text-3xl font-bold">
          Welcome back{user ? `, ${user.username}` : ""}! 👋
        </h1>
        <p className="mt-2 text-muted-foreground">
          Here's what's happening on your dashboard today.
        </p>
      </div>

      {/* Quick Actions */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {QUICK_ACTIONS.map(({ label, to, icon: Icon, description }) => (
            <Link key={to} to={to} className="block">
              <Card className="card-hover h-full cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming Events */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Upcoming Events</h2>
          <Link to="/dashboard/customer/events">
            <Button variant="ghost" size="sm">
              View all
            </Button>
          </Link>
        </div>

        {upcomingState.status === "loading" && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 py-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {upcomingState.status === "error" && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-destructive">{upcomingState.message}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setUpcomingState({ status: "loading" });
                  loadUpcoming();
                }}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {upcomingState.status === "ready" &&
          upcomingState.events.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-muted-foreground">
                  No upcoming events scheduled.
                </p>
                <Link to="/dashboard/customer/search">
                  <Button className="mt-4">Find an Expert</Button>
                </Link>
              </CardContent>
            </Card>
          )}

        {upcomingState.status === "ready" &&
          upcomingState.events.length > 0 && (
            <div className="space-y-3">
              {upcomingState.events.map((event) => (
                <Card key={event.id}>
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                        {event.expert.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">
                          {event.title ?? "Session"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          with {event.expert.username} •{" "}
                          {formatDate(event.start)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusVariant(event.status)}>
                      {event.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Recent Activity</h2>

        {activityState.status === "loading" && (
          <Card>
            <CardContent className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {activityState.status === "error" && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Unable to load recent activity.
            </CardContent>
          </Card>
        )}

        {activityState.status === "ready" &&
          activityState.events.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No activity yet.
              </CardContent>
            </Card>
          )}

        {activityState.status === "ready" &&
          activityState.events.length > 0 && (
            <Card>
              <CardContent className="divide-y py-0">
                {activityState.events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {event.title ?? "Session"} with{" "}
                          {event.expert.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(event.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={statusVariant(event.status)}
                      className="shrink-0"
                    >
                      {event.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
      </section>
    </div>
  );
}

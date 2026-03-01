import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { eventsApi, type EventListItem } from "@/api/eventsApi";
import { profileApi, type UserProfile } from "@/api/profileApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Calendar, DollarSign, CheckCircle, Clock, Plus, Settings } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

type LoadState = "loading" | "success" | "error";

// ── Pure helpers ──────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "accepted":
      return "default";
    case "pending":
      return "secondary";
    case "completed":
      return "outline";
    case "declined":
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function EventRow({ event }: { event: EventListItem }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {event.title ?? `Session with ${event.customer.username}`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDate(event.start)} · {event.customer.username}
        </p>
      </div>
      <Badge variant={statusVariant(event.status)} className="ml-4 shrink-0">
        {event.status}
      </Badge>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          {icon}
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ExpertHome() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [upcoming, setUpcoming] = useState<EventListItem[]>([]);
  const [pending, setPending] = useState<EventListItem[]>([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const loadData = useCallback(() => {
    Promise.all([
      profileApi.getProfile(),
      eventsApi.listEvents({ role: "as-expert", status: "accepted", limit: 5 }),
      eventsApi.listEvents({ role: "as-expert", status: "pending", limit: 5 }),
      eventsApi.listEvents({ role: "as-expert", status: "completed", limit: 1 }),
    ])
      .then(([profileRes, upcomingRes, pendingRes, completedRes]) => {
        setProfile(profileRes.user);
        setUpcoming(upcomingRes.events);
        setPending(pendingRes.events);
        setCompletedTotal(completedRes.total);
        setLoadState("success");
      })
      .catch(() => {
        setLoadState("error");
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loadState === "loading") {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="p-6">
        <div className="text-center py-16 text-muted-foreground">
          <p>Failed to load dashboard. Please try again.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setLoadState("loading"); loadData(); }}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const avgRating = profile ? profile.rating : 0;
  const hourlyRate = profile && profile.price.length > 0 ? profile.price[0] : 0;
  const estimatedEarnings = completedTotal * hourlyRate;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back{profile ? `, ${profile.username}` : ""}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s your dashboard overview
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<CheckCircle className="h-4 w-4" />}
          label="Sessions Completed"
          value={String(completedTotal)}
        />
        <StatCard
          icon={<Star className="h-4 w-4" />}
          label="Average Rating"
          value={avgRating.toFixed(1)}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Estimated Earnings"
          value={`${estimatedEarnings}`}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard/expert/availability")}
            >
              <Settings className="h-4 w-4" />
              Manage Availability
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard/expert/seminars")}
            >
              <Plus className="h-4 w-4" />
              Create Seminar
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard/expert/calendar")}
            >
              <Calendar className="h-4 w-4" />
              View Calendar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Upcoming Sessions
            </CardTitle>
            <CardDescription>Your next accepted sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No upcoming sessions
              </p>
            ) : (
              <div>
                {upcoming.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full"
              onClick={() => navigate("/dashboard/expert/events")}
            >
              View all events
            </Button>
          </CardContent>
        </Card>

        {/* Pending Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Pending Requests
            </CardTitle>
            <CardDescription>Requests requiring your action</CardDescription>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No pending requests
              </p>
            ) : (
              <div>
                {pending.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full"
              onClick={() => navigate("/dashboard/expert/events")}
            >
              Manage requests
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

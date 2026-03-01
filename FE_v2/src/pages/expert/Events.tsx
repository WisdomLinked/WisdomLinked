import { useState, useEffect, useCallback, type ReactNode } from "react";
import { eventsApi, type EventListItem, type EventStatus } from "@/api/eventsApi";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, DollarSign, CheckCircle, XCircle, Check } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

type LoadState = "loading" | "success" | "error";
type ActionKind = "accepting" | "declining" | "completing";

const PAGE_LIMIT = 10;

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
  status: EventStatus
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

function EventCard({
  event,
  actions,
}: {
  event: EventListItem;
  actions?: ReactNode;
}) {
  const initials = event.customer.username.slice(0, 2).toUpperCase();
  return (
    <div className="flex items-start gap-4 p-4 border rounded-lg">
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="font-medium">
              {event.title ?? `Session with ${event.customer.username}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {event.customer.username}
            </p>
          </div>
          <Badge variant={statusVariant(event.status)}>{event.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(event.start)}
          </span>
          {event.duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {event.duration} min
            </span>
          )}
          {event.price !== undefined && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />${event.price}
            </span>
          )}
        </div>
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

interface EventListSectionProps {
  events: EventListItem[];
  loadState: LoadState;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  renderActions?: (event: EventListItem) => ReactNode;
}

function EventListSection({
  events,
  loadState,
  page,
  totalPages,
  onPageChange,
  onRetry,
  renderActions,
}: EventListSectionProps) {
  if (loadState === "loading") {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Failed to load events.</p>
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No events found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            actions={renderActions?.(event)}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ExpertEvents() {
  // Pending
  const [pendingEvents, setPendingEvents] = useState<EventListItem[]>([]);
  const [pendingLoad, setPendingLoad] = useState<LoadState>("loading");
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotalPages, setPendingTotalPages] = useState(1);

  // Upcoming
  const [upcomingEvents, setUpcomingEvents] = useState<EventListItem[]>([]);
  const [upcomingLoad, setUpcomingLoad] = useState<LoadState>("loading");
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingTotalPages, setUpcomingTotalPages] = useState(1);

  // Past
  const [pastEvents, setPastEvents] = useState<EventListItem[]>([]);
  const [pastLoad, setPastLoad] = useState<LoadState>("loading");
  const [pastPage, setPastPage] = useState(1);
  const [pastTotalPages, setPastTotalPages] = useState(1);

  // Per-event action tracking (eventId → ActionKind)
  const [actionStates, setActionStates] = useState<
    Record<string, ActionKind>
  >({});

  const fetchPending = useCallback(async () => {
    try {
      setPendingLoad("loading");
      const res = await eventsApi.listEvents({
        role: "as-expert",
        status: "pending",
        page: pendingPage,
        limit: PAGE_LIMIT,
      });
      setPendingEvents(res.events);
      setPendingTotalPages(res.totalPages);
      setPendingLoad("success");
    } catch (err) {
      console.error("Failed to load pending events:", err);
      setPendingLoad("error");
    }
  }, [pendingPage]);

  const fetchUpcoming = useCallback(async () => {
    try {
      setUpcomingLoad("loading");
      const res = await eventsApi.listEvents({
        role: "as-expert",
        status: "accepted",
        page: upcomingPage,
        limit: PAGE_LIMIT,
      });
      setUpcomingEvents(res.events);
      setUpcomingTotalPages(res.totalPages);
      setUpcomingLoad("success");
    } catch (err) {
      console.error("Failed to load upcoming events:", err);
      setUpcomingLoad("error");
    }
  }, [upcomingPage]);

  const fetchPast = useCallback(async () => {
    try {
      setPastLoad("loading");
      const res = await eventsApi.listEvents({
        role: "as-expert",
        status: "completed",
        page: pastPage,
        limit: PAGE_LIMIT,
      });
      setPastEvents(res.events);
      setPastTotalPages(res.totalPages);
      setPastLoad("success");
    } catch (err) {
      console.error("Failed to load past events:", err);
      setPastLoad("error");
    }
  }, [pastPage]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);
  useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);
  useEffect(() => {
    fetchPast();
  }, [fetchPast]);

  const setAction = (eventId: string, kind: ActionKind | null) => {
    setActionStates((prev) => {
      const next = { ...prev };
      if (kind === null) {
        delete next[eventId];
      } else {
        next[eventId] = kind;
      }
      return next;
    });
  };

  const handleAccept = async (eventId: string) => {
    setAction(eventId, "accepting");
    try {
      await eventsApi.acceptEvent(eventId);
      window.toast({
        title: "Event accepted",
        description: "The session has been accepted.",
      });
      await fetchPending();
      await fetchUpcoming();
    } catch (err) {
      console.error("Failed to accept event:", err);
      window.toast({
        title: "Error",
        description: "Failed to accept event.",
        variant: "destructive",
      });
    } finally {
      setAction(eventId, null);
    }
  };

  const handleDecline = async (eventId: string) => {
    setAction(eventId, "declining");
    try {
      await eventsApi.declineEvent(eventId);
      window.toast({
        title: "Event declined",
        description: "The session has been declined.",
      });
      await fetchPending();
    } catch (err) {
      console.error("Failed to decline event:", err);
      window.toast({
        title: "Error",
        description: "Failed to decline event.",
        variant: "destructive",
      });
    } finally {
      setAction(eventId, null);
    }
  };

  const handleComplete = async (eventId: string) => {
    setAction(eventId, "completing");
    try {
      await eventsApi.completeEvent(eventId);
      window.toast({
        title: "Session completed",
        description: "The session has been marked as complete.",
      });
      await fetchUpcoming();
      await fetchPast();
    } catch (err) {
      console.error("Failed to complete event:", err);
      window.toast({
        title: "Error",
        description: "Failed to complete event.",
        variant: "destructive",
      });
    } finally {
      setAction(eventId, null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Events</h1>
        <p className="text-muted-foreground mt-1">
          Manage your sessions and bookings
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <EventListSection
            events={pendingEvents}
            loadState={pendingLoad}
            page={pendingPage}
            totalPages={pendingTotalPages}
            onPageChange={setPendingPage}
            onRetry={fetchPending}
            renderActions={(event) => (
              <>
                <Button
                  size="sm"
                  onClick={() => handleAccept(event.id)}
                  disabled={actionStates[event.id] !== undefined}
                >
                  <CheckCircle className="h-4 w-4" />
                  {actionStates[event.id] === "accepting"
                    ? "Accepting…"
                    : "Accept"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecline(event.id)}
                  disabled={actionStates[event.id] !== undefined}
                >
                  <XCircle className="h-4 w-4" />
                  {actionStates[event.id] === "declining"
                    ? "Declining…"
                    : "Decline"}
                </Button>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          <EventListSection
            events={upcomingEvents}
            loadState={upcomingLoad}
            page={upcomingPage}
            totalPages={upcomingTotalPages}
            onPageChange={setUpcomingPage}
            onRetry={fetchUpcoming}
            renderActions={(event) => (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleComplete(event.id)}
                disabled={actionStates[event.id] !== undefined}
              >
                <Check className="h-4 w-4" />
                {actionStates[event.id] === "completing"
                  ? "Completing…"
                  : "Mark Complete"}
              </Button>
            )}
          />
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          <EventListSection
            events={pastEvents}
            loadState={pastLoad}
            page={pastPage}
            totalPages={pastTotalPages}
            onPageChange={setPastPage}
            onRetry={fetchPast}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

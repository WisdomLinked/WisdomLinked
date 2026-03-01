import { useCallback, useEffect, useState } from "react";
import { Clock, DollarSign, Star } from "lucide-react";

import {
  eventsApi,
  type EventListItem,
  type EventStatus,
  type FeedbackData,
} from "@/api/eventsApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type TabKey = "upcoming" | "pending" | "past";

type TabState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; events: EventListItem[]; total: number; totalPages: number; page: number };

type TabsData = Record<TabKey, TabState>;

interface FeedbackDialog {
  eventId: string;
  rating: number;
  comment: string;
  submitting: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const TAB_CONFIG: Array<{ key: TabKey; label: string; status: EventStatus }> = [
  { key: "upcoming", label: "Upcoming", status: "accepted" },
  { key: "pending", label: "Pending", status: "pending" },
  { key: "past", label: "Past", status: "completed" },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "Date TBD";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number | undefined): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function statusVariant(
  status: EventStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "accepted") return "default";
  if (status === "completed") return "secondary";
  if (status === "cancelled" || status === "declined") return "destructive";
  return "outline";
}

// ── Star Rating ────────────────────────────────────────────────────────────

interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
}

function StarRating({ value, onChange }: StarRatingProps) {
  return (
    <div className="flex gap-1" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={cn(
            "rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            star <= value ? "text-primary" : "text-muted-foreground",
          )}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "h-6 w-6",
              star <= value && "fill-primary",
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ── Event Card ─────────────────────────────────────────────────────────────

interface EventCardProps {
  event: EventListItem;
  tabKey: TabKey;
  onCancel: (eventId: string) => void;
  onFeedback: (eventId: string) => void;
  cancelling: boolean;
}

function EventCard({ event, tabKey, onCancel, onFeedback, cancelling }: EventCardProps) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{event.title ?? "Session"}</p>
              <Badge variant={statusVariant(event.status)} className="text-xs">
                {event.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              with {event.expert.username}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{formatDate(event.start)}</span>
              {event.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(event.duration)}
                </span>
              )}
              {event.price !== undefined && event.price > 0 && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {event.price}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-2">
            {(tabKey === "upcoming" || tabKey === "pending") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={cancelling}
                  >
                    {cancelling ? "Cancelling..." : "Cancel"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Event</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel this event? This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Event</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onCancel(event.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, Cancel
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {tabKey === "past" && event.status === "completed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFeedback(event.id)}
              >
                <Star className="mr-1.5 h-3.5 w-3.5" />
                Submit Feedback
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tab Content ────────────────────────────────────────────────────────────

interface TabPanelProps {
  tabKey: TabKey;
  state: TabState;
  onLoad: (tabKey: TabKey, page: number) => void;
  cancellingId: string | null;
  onCancel: (eventId: string) => void;
  onFeedback: (eventId: string) => void;
}

function TabPanel({ tabKey, state, onLoad, cancellingId, onCancel, onFeedback }: TabPanelProps) {
  const currentPage = state.status === "ready" ? state.page : 1;
  const totalPages = state.status === "ready" ? state.totalPages : 1;

  return (
    <div className="space-y-4">
      {state.status === "idle" && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Button variant="outline" onClick={() => onLoad(tabKey, 1)}>
              Load events
            </Button>
          </CardContent>
        </Card>
      )}

      {state.status === "loading" && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="flex justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {state.status === "error" && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{state.message}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => onLoad(tabKey, 1)}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {state.status === "ready" && state.events.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No {tabKey} events found.
          </CardContent>
        </Card>
      )}

      {state.status === "ready" && state.events.length > 0 && (
        <>
          <div className="space-y-3">
            {state.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                tabKey={tabKey}
                onCancel={onCancel}
                onFeedback={onFeedback}
                cancelling={cancellingId === event.id}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) onLoad(tabKey, currentPage - 1);
                    }}
                    aria-disabled={currentPage === 1}
                    className={
                      currentPage === 1 ? "pointer-events-none opacity-50" : ""
                    }
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="flex h-9 items-center px-3 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages)
                        onLoad(tabKey, currentPage + 1);
                    }}
                    aria-disabled={currentPage === totalPages}
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
}

// ── Page Component ─────────────────────────────────────────────────────────

export default function CustomerEvents() {
  const [activeTab, setActiveTab] = useState<TabKey>("upcoming");
  // upcoming starts as "loading" since it loads immediately on mount
  const [tabsData, setTabsData] = useState<TabsData>({
    upcoming: { status: "loading" },
    pending: { status: "idle" },
    past: { status: "idle" },
  });
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [feedbackDialog, setFeedbackDialog] =
    useState<FeedbackDialog | null>(null);

  // No synchronous setState before async call — avoids react-hooks/set-state-in-effect.
  const loadTab = useCallback((tabKey: TabKey, page: number) => {
    const tabConfig = TAB_CONFIG.find((t) => t.key === tabKey);
    if (!tabConfig) return;

    eventsApi
      .listEvents({
        role: "as-customer",
        status: tabConfig.status,
        page,
        limit: PAGE_SIZE,
      })
      .then((data) => {
        setTabsData((prev) => ({
          ...prev,
          [tabKey]: {
            status: "ready",
            events: data.events,
            total: data.total,
            totalPages: data.totalPages,
            page: data.page,
          },
        }));
      })
      .catch(() => {
        setTabsData((prev) => ({
          ...prev,
          [tabKey]: {
            status: "error",
            message: `Failed to load ${tabKey} events.`,
          },
        }));
      });
  }, []);

  // Wrapper that sets loading state (safe to call from click handlers)
  const triggerLoadTab = useCallback(
    (tabKey: TabKey, page: number) => {
      setTabsData((prev) => ({
        ...prev,
        [tabKey]: { status: "loading" },
      }));
      loadTab(tabKey, page);
    },
    [loadTab],
  );

  // Initial load on mount — loadTab uses .then/.catch so no synchronous setState
  useEffect(() => {
    loadTab("upcoming", 1);
  }, [loadTab]);

  const handleTabChange = useCallback(
    (value: string) => {
      const key = value as TabKey;
      setActiveTab(key);
      const current = tabsData[key];
      if (current.status === "idle") {
        triggerLoadTab(key, 1);
      }
    },
    [tabsData, triggerLoadTab],
  );

  const handleCancel = useCallback(
    async (eventId: string) => {
      setCancellingId(eventId);
      try {
        await eventsApi.cancelEvent(eventId);
        window.toast({ title: "Event cancelled successfully." });
        // Reload both upcoming and pending tabs
        triggerLoadTab("upcoming", 1);
        triggerLoadTab("pending", 1);
      } catch {
        window.toast({
          title: "Cancel failed",
          description: "Unable to cancel the event. Please try again.",
          variant: "destructive",
        });
      } finally {
        setCancellingId(null);
      }
    },
    [triggerLoadTab],
  );

  const handleOpenFeedback = useCallback((eventId: string) => {
    setFeedbackDialog({ eventId, rating: 5, comment: "", submitting: false });
  }, []);

  const handleSubmitFeedback = useCallback(async () => {
    if (!feedbackDialog) return;

    setFeedbackDialog((prev) =>
      prev ? { ...prev, submitting: true } : null,
    );

    const data: FeedbackData = {
      rating: feedbackDialog.rating,
      comment:
        feedbackDialog.comment !== "" ? feedbackDialog.comment : undefined,
    };

    try {
      await eventsApi.submitFeedback(feedbackDialog.eventId, data);
      window.toast({ title: "Feedback submitted. Thank you!" });
      setFeedbackDialog(null);
      triggerLoadTab("past", 1);
    } catch {
      window.toast({
        title: "Submission failed",
        description: "Unable to submit feedback. Please try again.",
        variant: "destructive",
      });
      setFeedbackDialog((prev) =>
        prev ? { ...prev, submitting: false } : null,
      );
    }
  }, [feedbackDialog, triggerLoadTab]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">My Events</h1>
        <p className="mt-1 text-muted-foreground">
          Track all your sessions and appointments
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
      >
        <TabsList className="w-full sm:w-auto">
          {TAB_CONFIG.map(({ key, label }) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_CONFIG.map(({ key }) => (
          <TabsContent key={key} value={key} className="mt-6">
            <TabPanel
              tabKey={key}
              state={tabsData[key]}
              onLoad={triggerLoadTab}
              cancellingId={cancellingId}
              onCancel={handleCancel}
              onFeedback={handleOpenFeedback}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Feedback Dialog */}
      <Dialog
        open={feedbackDialog !== null}
        onOpenChange={(open) => !open && setFeedbackDialog(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Feedback</DialogTitle>
          </DialogHeader>
          {feedbackDialog !== null && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rating</Label>
                <StarRating
                  value={feedbackDialog.rating}
                  onChange={(r) =>
                    setFeedbackDialog((prev) =>
                      prev ? { ...prev, rating: r } : null,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-comment">Comment (optional)</Label>
                <Textarea
                  id="feedback-comment"
                  value={feedbackDialog.comment}
                  onChange={(e) =>
                    setFeedbackDialog((prev) =>
                      prev ? { ...prev, comment: e.target.value } : null,
                    )
                  }
                  placeholder="Share your experience..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFeedbackDialog(null)}
              disabled={feedbackDialog?.submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={feedbackDialog?.submitting}
            >
              {feedbackDialog?.submitting ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

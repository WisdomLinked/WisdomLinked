import { useCallback, useEffect, useState } from "react";

import {
  eventsApi,
  type EventStatus,
  type FeedbackData,
} from "@/api/eventsApi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { StarRating, type TabKey } from "./EventCard";
import {
  TabPanel,
  type TabConfig,
  type TabState,
  type TabsData,
} from "./EventTabPanel";

// ── Types ──────────────────────────────────────────────────────────────────

interface FeedbackDialog {
  eventId: string;
  rating: number;
  comment: string;
  submitting: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const TAB_CONFIG: Array<TabConfig> = [
  { key: "upcoming", label: "Upcoming", status: "accepted" as EventStatus },
  { key: "pending", label: "Pending", status: "pending" as EventStatus },
  { key: "past", label: "Past", status: "completed" as EventStatus },
];

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
          } satisfies TabState,
        }));
      })
      .catch(() => {
        setTabsData((prev) => ({
          ...prev,
          [tabKey]: {
            status: "error",
            message: `Failed to load ${tabKey} events.`,
          } satisfies TabState,
        }));
      });
  }, []);

  // Wrapper that sets loading state (safe to call from click handlers)
  const triggerLoadTab = useCallback(
    (tabKey: TabKey, page: number) => {
      setTabsData((prev) => ({
        ...prev,
        [tabKey]: { status: "loading" } satisfies TabState,
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

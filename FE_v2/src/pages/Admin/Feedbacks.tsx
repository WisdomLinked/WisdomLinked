import { useState, useEffect, useCallback } from "react";
import { feedbackApi, EventWithFeedback } from "@/api/adminApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Star, CalendarCheck, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function AdminFeedbacks() {
  const [events, setEvents] = useState<EventWithFeedback[]>([]);
  const [expertId, setExpertId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await feedbackApi.list({
        expertId: expertId || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });
      setEvents(response.items);
      setPagination((p) => ({
        ...p,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      }));
    } catch (error) {
      console.error("Failed to fetch event feedbacks:", error);
    } finally {
      setLoading(false);
    }
  }, [expertId, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const totalFeedbackEntries = events.reduce(
    (sum, event) => sum + event.feedbacks.length,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Event Feedback</h1>
        <p className="text-muted-foreground mt-1">
          View feedback for completed events (read-only)
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Events with Feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Feedback Entries (this page)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFeedbackEntries}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Filter by expert ID..."
            value={expertId}
            onChange={(e) => setExpertId(e.target.value)}
          />
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Events ({pagination.total})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{event.title}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                        <span>Expert: {event.expertName}</span>
                        <span>Customer: {event.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          Completed:{" "}
                          {new Date(event.completedAt).toLocaleDateString()}
                        </p>
                        <span className="px-2 py-0.5 text-xs rounded bg-muted">
                          {event.feedbacks.length} feedback
                          {event.feedbacks.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    {event.feedbacks.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setExpandedId(
                            expandedId === event.id ? null : event.id,
                          )
                        }
                      >
                        {expandedId === event.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>

                  {expandedId === event.id && event.feedbacks.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {event.feedbacks.map((fb) => (
                        <div
                          key={fb.id}
                          className="p-3 bg-muted/50 rounded border"
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {fb.authorUsername}
                            </p>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }, (_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${
                                    i < fb.rating
                                      ? "text-yellow-500 fill-yellow-500"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          {fb.comment && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {fb.comment}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(fb.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {events.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No events found
                </div>
              )}
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  disabled={pagination.page === 1}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page - 1 }))
                  }
                >
                  Previous
                </Button>
                <span className="px-4 py-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page + 1 }))
                  }
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

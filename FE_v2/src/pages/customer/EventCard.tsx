import { Clock, DollarSign, Star } from "lucide-react";

import { type EventListItem, type EventStatus } from "@/api/eventsApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type TabKey = "upcoming" | "pending" | "past";

// ── Helpers ────────────────────────────────────────────────────────────────

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "Date TBD";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(minutes: number | undefined): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function statusVariant(
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

export function StarRating({ value, onChange }: StarRatingProps) {
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

export interface EventCardProps {
  event: EventListItem;
  tabKey: TabKey;
  onCancel: (eventId: string) => void;
  onFeedback: (eventId: string) => void;
  cancelling: boolean;
}

export function EventCard({
  event,
  tabKey,
  onCancel,
  onFeedback,
  cancelling,
}: EventCardProps) {
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

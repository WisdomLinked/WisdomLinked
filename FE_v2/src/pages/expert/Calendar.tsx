import { useState, useEffect, useCallback } from "react";
import {
  eventsApi,
  type CalendarEvent,
  type EventStatus,
} from "@/api/eventsApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

type LoadState = "loading" | "success" | "error";

// ── Pure calendar helpers ─────────────────────────────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function buildCells(year: number, month: number): Array<number | null> {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function getEventsForDay(
  events: CalendarEvent[],
  year: number,
  month: number,
  day: number
): CalendarEvent[] {
  return events.filter((ev) => {
    if (!ev.start) return false;
    const d = new Date(ev.start);
    return (
      d.getFullYear() === year &&
      d.getMonth() === month &&
      d.getDate() === day
    );
  });
}

function eventDotClass(status: EventStatus): string {
  switch (status) {
    case "accepted":
      return "bg-green-500";
    case "pending":
      return "bg-yellow-400";
    case "completed":
      return "bg-muted-foreground";
    case "declined":
    case "cancelled":
      return "bg-destructive";
    default:
      return "bg-muted-foreground";
  }
}

function eventPillClass(status: EventStatus): string {
  switch (status) {
    case "accepted":
      return "bg-green-500/15 text-green-700 border-green-300/50";
    case "pending":
      return "bg-yellow-400/15 text-yellow-700 border-yellow-300/50";
    case "completed":
      return "bg-muted text-muted-foreground border-border";
    case "declined":
    case "cancelled":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground";
  }
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

// ── Page ──────────────────────────────────────────────────────────────────

export default function ExpertCalendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const fetchCalendar = useCallback((year: number, month: number) => {
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    eventsApi.getCalendar(startDate, endDate)
      .then((res) => {
        setEvents(res.events);
        setLoadState("success");
      })
      .catch(() => {
        setLoadState("error");
      });
  }, []);

  useEffect(() => {
    fetchCalendar(viewYear, viewMonth);
  }, [fetchCalendar, viewYear, viewMonth]);

  const handlePrevMonth = () => {
    setLoadState("loading");
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    setLoadState("loading");
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDay(null);
  };

  const cells = buildCells(viewYear, viewMonth);
  const selectedEvents =
    selectedDay !== null
      ? getEventsForDay(events, viewYear, viewMonth, selectedDay)
      : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Calendar</h1>
        <p className="text-muted-foreground mt-1">
          View your scheduled sessions and seminars
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {(
          [
            { label: "Accepted", cls: "bg-green-500" },
            { label: "Pending", cls: "bg-yellow-400" },
            { label: "Completed", cls: "bg-muted-foreground" },
          ] as const
        ).map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-2.5 rounded-full", cls)} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadState === "loading" ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : loadState === "error" ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Failed to load calendar.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => { setLoadState("loading"); fetchCalendar(viewYear, viewMonth); }}
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} />;
                  }
                  const dayEvents = getEventsForDay(
                    events,
                    viewYear,
                    viewMonth,
                    day
                  );
                  const isToday =
                    today.getDate() === day &&
                    today.getMonth() === viewMonth &&
                    today.getFullYear() === viewYear;
                  const isSelected = selectedDay === day;

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        setSelectedDay(isSelected ? null : day)
                      }
                      className={cn(
                        "min-h-[60px] p-1 rounded-md border text-sm transition-colors text-left",
                        "hover:bg-accent hover:border-accent-foreground/20",
                        isToday && "border-primary bg-primary/5",
                        isSelected &&
                          "bg-accent border-accent-foreground/30 ring-1 ring-ring"
                      )}
                    >
                      <div
                        className={cn(
                          "h-5 w-5 flex items-center justify-center rounded-full text-xs font-medium mb-1",
                          isToday &&
                            "bg-primary text-primary-foreground"
                        )}
                      >
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className={cn(
                              "text-[10px] px-1 py-0.5 rounded border truncate",
                              eventPillClass(ev.status)
                            )}
                          >
                            {ev.title ?? ev.customer.username}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Day detail panel */}
      {selectedDay !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              {MONTH_NAMES[viewMonth]} {selectedDay}, {viewYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No events on this day.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between gap-4 p-3 rounded-lg border"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                          eventDotClass(ev.status)
                        )}
                      />
                      <div>
                        <p className="font-medium text-sm">
                          {ev.title ??
                            `Session with ${ev.customer.username}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Customer: {ev.customer.username}
                        </p>
                        {ev.start && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(ev.start).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {ev.end &&
                              ` – ${new Date(ev.end).toLocaleTimeString(
                                "en-US",
                                { hour: "2-digit", minute: "2-digit" }
                              )}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={statusVariant(ev.status)}>
                      {ev.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

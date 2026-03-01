import { useEffect, useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

import { eventsApi, type CalendarEvent } from "@/api/eventsApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface CalendarView {
  year: number;
  month: number; // 0-indexed
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; events: CalendarEvent[] };

// ── Constants ──────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
];

// ── Helpers ────────────────────────────────────────────────────────────────

function padTwo(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${padTwo(month + 1)}-${padTwo(day)}`;
}

function buildCalendarCells(year: number, month: number): Array<{ day: number; inMonth: boolean; dateKey: string }> {
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ day: number; inMonth: boolean; dateKey: string }> = [];

  // Leading empty cells (days from prev month)
  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push({ day: 0, inMonth: false, dateKey: "" });
  }
  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, dateKey: toDateKey(year, month, d) });
  }
  // Trailing cells to complete the last row
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells.push({ day: 0, inMonth: false, dateKey: "" });
    }
  }

  return cells;
}

function buildEventsByDay(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (!event.start) continue;
    const key = event.start.substring(0, 10);
    const existing = map.get(key) ?? [];
    map.set(key, [...existing, event]);
  }
  return map;
}

function formatTime(dateStr: string | undefined): string {
  if (!dateStr) return "Time TBD";
  return new Date(dateStr).toLocaleTimeString(undefined, {
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

// ── Component ──────────────────────────────────────────────────────────────

export default function CustomerCalendar() {
  const today = new Date();
  const [view, setView] = useState<CalendarView>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // No synchronous setState before async call — avoids react-hooks/set-state-in-effect.
  // Loading state is set in navigation handlers and retry buttons instead.
  const loadCalendar = useCallback((year: number, month: number) => {
    const startDate = toDateKey(year, month, 1);
    const endDate = toDateKey(year, month, new Date(year, month + 1, 0).getDate());
    eventsApi
      .getCalendar(startDate, endDate)
      .then(({ events }) => {
        setLoadState({ status: "ready", events });
      })
      .catch(() => {
        setLoadState({ status: "error", message: "Failed to load calendar events." });
      });
  }, []);

  useEffect(() => {
    loadCalendar(view.year, view.month);
  }, [view, loadCalendar]);

  const handlePrevMonth = useCallback(() => {
    setLoadState({ status: "loading" });
    setView((v) => {
      if (v.month === 0) return { year: v.year - 1, month: 11 };
      return { year: v.year, month: v.month - 1 };
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setLoadState({ status: "loading" });
    setView((v) => {
      if (v.month === 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: v.month + 1 };
    });
  }, []);

  const cells = buildCalendarCells(view.year, view.month);
  const eventsByDay =
    loadState.status === "ready"
      ? buildEventsByDay(loadState.events)
      : new Map<string, CalendarEvent[]>();

  const todayKey = toDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const selectedDayEvents =
    selectedDay !== null ? (eventsByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">My Calendar</h1>
        <p className="mt-1 text-muted-foreground">
          View and manage your scheduled sessions
        </p>
      </div>

      <Card>
        {/* Month Navigation */}
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth} aria-label="Previous month">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-lg">
              {MONTH_NAMES[view.month]} {view.year}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} aria-label="Next month">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-xs font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Loading overlay */}
          {loadState.status === "loading" && (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          )}

          {/* Error */}
          {loadState.status === "error" && (
            <div className="py-8 text-center">
              <p className="text-destructive">{loadState.message}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setLoadState({ status: "loading" });
                  loadCalendar(view.year, view.month);
                }}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Calendar grid */}
          {loadState.status === "ready" && (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, idx) => {
                const dayEvents =
                  cell.inMonth ? (eventsByDay.get(cell.dateKey) ?? []) : [];
                const isToday = cell.dateKey === todayKey;
                const isSelected = cell.dateKey === selectedDay;
                const hasEvents = dayEvents.length > 0;

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!cell.inMonth}
                    onClick={() =>
                      cell.inMonth
                        ? setSelectedDay(
                            selectedDay === cell.dateKey ? null : cell.dateKey,
                          )
                        : undefined
                    }
                    className={cn(
                      "relative flex min-h-[3.5rem] flex-col items-center rounded-md p-1 text-sm transition-colors",
                      cell.inMonth
                        ? "hover:bg-accent cursor-pointer"
                        : "cursor-default opacity-0",
                      isToday && "ring-2 ring-primary",
                      isSelected && "bg-primary/10",
                    )}
                    aria-label={
                      cell.inMonth
                        ? `${MONTH_NAMES[view.month]} ${cell.day}, ${view.year}${hasEvents ? ` — ${dayEvents.length} event${dayEvents.length !== 1 ? "s" : ""}` : ""}`
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                        isToday &&
                          "bg-primary text-primary-foreground font-bold",
                        !isToday && "font-medium",
                      )}
                    >
                      {cell.inMonth ? cell.day : ""}
                    </span>
                    {hasEvents && (
                      <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                        {dayEvents.slice(0, 3).map((ev, i) => (
                          <span
                            key={i}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              ev.status === "accepted"
                                ? "bg-primary"
                                : ev.status === "completed"
                                  ? "bg-muted-foreground"
                                  : "bg-destructive",
                            )}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[9px] text-muted-foreground">
                            +{dayEvents.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          {loadState.status === "ready" && (
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Accepted
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                Completed
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-destructive" />
                Cancelled / Declined
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day Events Dialog */}
      <Dialog
        open={selectedDay !== null}
        onOpenChange={(open) => !open && setSelectedDay(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {selectedDay
                ? new Date(selectedDay + "T00:00:00").toLocaleDateString(
                    undefined,
                    { weekday: "long", month: "long", day: "numeric" },
                  )
                : ""}
            </DialogTitle>
          </DialogHeader>

          {selectedDayEvents.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">
              No events on this day.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedDayEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{event.title ?? "Session"}</p>
                    <p className="text-sm text-muted-foreground">
                      with {event.expert.username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(event.start)}
                      {event.end ? ` – ${formatTime(event.end)}` : ""}
                    </p>
                  </div>
                  <Badge variant={statusVariant(event.status)}>
                    {event.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

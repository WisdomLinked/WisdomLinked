import { type EventListItem, type EventStatus } from "@/api/eventsApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

import { EventCard, type TabKey } from "./EventCard";

// ── Tab State types ────────────────────────────────────────────────────────

export type TabState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      events: EventListItem[];
      total: number;
      totalPages: number;
      page: number;
    };

export type TabsData = Record<TabKey, TabState>;

export interface TabConfig {
  key: TabKey;
  label: string;
  status: EventStatus;
}

// ── Tab Panel ──────────────────────────────────────────────────────────────

export interface TabPanelProps {
  tabKey: TabKey;
  state: TabState;
  onLoad: (tabKey: TabKey, page: number) => void;
  cancellingId: string | null;
  onCancel: (eventId: string) => void;
  onFeedback: (eventId: string) => void;
}

export function TabPanel({
  tabKey,
  state,
  onLoad,
  cancellingId,
  onCancel,
  onFeedback,
}: TabPanelProps) {
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

import { useEffect, useCallback, useState } from "react";
import { Users, Calendar, DollarSign, Video } from "lucide-react";

import {
  groupChatsApi,
  type GroupChat,
  type GroupChatListParams,
} from "@/api/groupChatsApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/ui/search-input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
} from "@/components/ui/pagination";

// ── Types ──────────────────────────────────────────────────────────────────

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      seminars: GroupChat[];
      total: number;
      totalPages: number;
    };

type JoiningState = Record<string, "idle" | "joining" | "joined" | "error">;

// ── Helpers ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 9;

function formatDateRange(
  start: string | undefined,
  end: string | undefined,
): string {
  if (!start) return "Date TBD";
  const startStr = new Date(start).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (!end) return startStr;
  const endStr = new Date(end).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "completed") return "secondary";
  if (status === "cancelled") return "destructive";
  return "outline";
}

function buildPageRange(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: number[] = [];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  pages.push(1);
  if (start > 2) pages.push(-1);
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push(-2);
  pages.push(total);
  return pages;
}

// ── Seminar Card ───────────────────────────────────────────────────────────

interface SeminarCardProps {
  seminar: GroupChat;
  joiningStatus: "idle" | "joining" | "joined" | "error";
  onJoin: () => void;
}

function SeminarCard({ seminar, joiningStatus, onJoin }: SeminarCardProps) {
  const participantCount = seminar.participants.length;
  const isFull = false; // No max cap data in API
  const canJoin =
    seminar.status === "active" || seminar.status === "pending";

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{seminar.name}</CardTitle>
          </div>
          <Badge variant={statusVariant(seminar.status)} className="shrink-0">
            {seminar.status}
          </Badge>
        </div>
        {seminar.description && (
          <CardDescription className="line-clamp-2">
            {seminar.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          {formatDateRange(seminar.start, seminar.end)}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" />
          {participantCount} participant{participantCount !== 1 ? "s" : ""}
        </div>
        {seminar.price !== undefined && seminar.price > 0 && (
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <DollarSign className="h-4 w-4 shrink-0" />
            ${seminar.price}
          </div>
        )}
        {(seminar.price === undefined || seminar.price === 0) && (
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <DollarSign className="h-4 w-4 shrink-0" />
            Free
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          onClick={onJoin}
          disabled={
            !canJoin ||
            joiningStatus === "joining" ||
            joiningStatus === "joined" ||
            isFull
          }
          variant={joiningStatus === "joined" ? "secondary" : "default"}
        >
          {joiningStatus === "joining"
            ? "Joining..."
            : joiningStatus === "joined"
              ? "Joined ✓"
              : joiningStatus === "error"
                ? "Failed — Retry"
                : "Join Seminar"}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ── Page Component ─────────────────────────────────────────────────────────

export default function CustomerSeminars() {
  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const [keyword, setKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [joiningState, setJoiningState] = useState<JoiningState>({});

  const loadSeminars = useCallback(
    async (params: GroupChatListParams) => {
      setPageState({ status: "loading" });
      try {
        const data = await groupChatsApi.listGroupChats(params);
        setPageState({
          status: "ready",
          seminars: data.groupChats,
          total: data.total,
          totalPages: data.totalPages,
        });
      } catch {
        setPageState({
          status: "error",
          message: "Failed to load seminars.",
        });
      }
    },
    [],
  );

  useEffect(() => {
    const params: GroupChatListParams = {
      type: "seminar",
      page: currentPage,
      limit: PAGE_SIZE,
    };
    if (keyword !== "") params.keyword = keyword;
    loadSeminars(params);
  }, [keyword, currentPage, loadSeminars]);

  const handleJoin = useCallback(
    async (seminarId: string) => {
      setJoiningState((prev) => ({ ...prev, [seminarId]: "joining" }));
      try {
        await groupChatsApi.joinGroupChat(seminarId);
        setJoiningState((prev) => ({ ...prev, [seminarId]: "joined" }));
        window.toast({
          title: "Joined seminar",
          description: "You have successfully joined the seminar.",
        });
      } catch {
        setJoiningState((prev) => ({ ...prev, [seminarId]: "error" }));
        window.toast({
          title: "Failed to join",
          description: "Unable to join this seminar. Please try again.",
          variant: "destructive",
        });
      }
    },
    [],
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const totalPages =
    pageState.status === "ready" ? pageState.totalPages : 1;
  const pageRange = buildPageRange(currentPage, totalPages);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Browse Seminars</h1>
        <p className="mt-1 text-muted-foreground">
          Join live seminars hosted by expert instructors
        </p>
      </div>

      {/* Search Filter */}
      <div className="flex gap-3">
        <SearchInput
          className="max-w-sm flex-1"
          placeholder="Search seminars..."
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setCurrentPage(1);
          }}
          onClear={() => {
            setKeyword("");
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Loading skeleton */}
      {pageState.status === "loading" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {pageState.status === "error" && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{pageState.message}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                const params: GroupChatListParams = {
                  type: "seminar",
                  page: currentPage,
                  limit: PAGE_SIZE,
                };
                if (keyword !== "") params.keyword = keyword;
                loadSeminars(params);
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {pageState.status === "ready" && pageState.seminars.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">
              No seminars found
              {keyword !== "" ? ` for "${keyword}"` : ""}.
            </p>
            {keyword !== "" && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setKeyword("");
                  setCurrentPage(1);
                }}
              >
                Clear Filter
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seminar grid */}
      {pageState.status === "ready" && pageState.seminars.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {pageState.total} seminar{pageState.total !== 1 ? "s" : ""} available
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageState.seminars.map((seminar) => (
              <SeminarCard
                key={seminar._id}
                seminar={seminar}
                joiningStatus={joiningState[seminar._id] ?? "idle"}
                onJoin={() => handleJoin(seminar._id)}
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
                      if (currentPage > 1) handlePageChange(currentPage - 1);
                    }}
                    aria-disabled={currentPage === 1}
                    className={
                      currentPage === 1 ? "pointer-events-none opacity-50" : ""
                    }
                  />
                </PaginationItem>
                {pageRange.map((p, idx) =>
                  p < 0 ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <span className="flex h-9 w-9 items-center justify-center text-muted-foreground">
                        …
                      </span>
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={currentPage === p}
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(p);
                        }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages)
                        handlePageChange(currentPage + 1);
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

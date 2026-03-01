import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  searchApi,
  type ExpertResult,
  type SearchExpertsParams,
} from "@/api/searchApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { ExpertCard } from "./ExpertCard";
import { ExpertDetailDialog } from "./ExpertDetailDialog";

// ── Types ──────────────────────────────────────────────────────────────────

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      experts: ExpertResult[];
      total: number;
      totalPages: number;
      page: number;
    };

interface Filters {
  name: string;
  minRating: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;

function buildPageRange(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: number[] = [];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  pages.push(1);
  if (start > 2) pages.push(-1); // ellipsis sentinel
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push(-2); // ellipsis sentinel
  pages.push(total);
  return pages;
}

// ── Page Component ─────────────────────────────────────────────────────────

export default function CustomerSearch() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const [filters, setFilters] = useState<Filters>({
    name: "",
    minRating: "0",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedExpert, setSelectedExpert] = useState<ExpertResult | null>(
    null,
  );

  // No synchronous setState before async call — avoids react-hooks/set-state-in-effect.
  const loadExperts = useCallback((params: SearchExpertsParams) => {
    searchApi
      .searchExperts(params)
      .then(({ experts, pagination }) => {
        setPageState({
          status: "ready",
          experts,
          total: pagination.total,
          totalPages: pagination.totalPages,
          page: pagination.page,
        });
      })
      .catch(() => {
        setPageState({ status: "error", message: "Failed to load experts." });
      });
  }, []);

  useEffect(() => {
    const params: SearchExpertsParams = {
      page: currentPage,
      limit: PAGE_SIZE,
    };
    if (filters.name !== "") params.name = filters.name;
    const rating = parseFloat(filters.minRating);
    if (!isNaN(rating) && rating > 0) params.rating = rating;
    loadExperts(params);
  }, [filters, currentPage, loadExperts]);

  const handleClearSearch = useCallback(() => {
    setFilters((f) => ({ ...f, name: "" }));
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleBookSession = useCallback(() => {
    setSelectedExpert(null);
    window.toast({
      title: "Connect to book",
      description: "Message the expert directly to schedule your session.",
    });
    navigate("/dashboard/messenger");
  }, [navigate]);

  const buildParams = (): SearchExpertsParams => {
    const params: SearchExpertsParams = { page: currentPage, limit: PAGE_SIZE };
    if (filters.name !== "") params.name = filters.name;
    const rating = parseFloat(filters.minRating);
    if (!isNaN(rating) && rating > 0) params.rating = rating;
    return params;
  };

  const totalPages =
    pageState.status === "ready" ? pageState.totalPages : 1;
  const pageRange = buildPageRange(currentPage, totalPages);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Search Experts</h1>
        <p className="mt-1 text-muted-foreground">
          Find the right expert for your needs
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          className="flex-1"
          placeholder="Search by name..."
          value={filters.name}
          onChange={(e) => {
            setFilters((f) => ({ ...f, name: e.target.value }));
            setCurrentPage(1);
          }}
          onClear={handleClearSearch}
        />
        <Select
          value={filters.minRating}
          onValueChange={(v) => {
            setFilters((f) => ({ ...f, minRating: v }));
            setCurrentPage(1);
          }}
          placeholder="Min. Rating"
          className="w-full sm:w-44"
        >
          <SelectItem value="0">Any Rating</SelectItem>
          <SelectItem value="3">3+ Stars</SelectItem>
          <SelectItem value="4">4+ Stars</SelectItem>
          <SelectItem value="4.5">4.5+ Stars</SelectItem>
        </Select>
      </div>

      {/* Loading skeleton */}
      {pageState.status === "loading" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-14 w-full" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 flex-1" />
                  <Skeleton className="h-9 flex-1" />
                </div>
              </CardContent>
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
                setPageState({ status: "loading" });
                loadExperts(buildParams());
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {pageState.status === "ready" && pageState.experts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No experts found matching your criteria.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setFilters({ name: "", minRating: "0" });
                setCurrentPage(1);
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {pageState.status === "ready" && pageState.experts.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {pageState.total} expert
            {pageState.total !== 1 ? "s" : ""} found
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageState.experts.map((expert) => (
              <ExpertCard
                key={expert.id}
                expert={expert}
                onView={() => setSelectedExpert(expert)}
                onBook={() => {
                  setSelectedExpert(expert);
                }}
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

      {/* Expert Detail Dialog */}
      <ExpertDetailDialog
        expert={selectedExpert}
        onClose={() => setSelectedExpert(null)}
        onMessage={handleBookSession}
      />
    </div>
  );
}

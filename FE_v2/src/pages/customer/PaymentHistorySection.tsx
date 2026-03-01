import { CheckCircle, Clock, XCircle } from "lucide-react";

import { type Payment } from "@/api/paymentApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──────────────────────────────────────────────────────────────────

export type HistoryState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; payments: Payment[] };

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100); // Stripe amounts are in cents
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function paymentStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "succeeded" || status === "paid") return "default";
  if (status === "pending") return "outline";
  if (status === "failed" || status === "canceled") return "destructive";
  return "secondary";
}

function paymentStatusIcon(status: string) {
  if (status === "succeeded" || status === "paid")
    return <CheckCircle className="h-4 w-4 text-primary" />;
  if (status === "pending")
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

// ── History Section ────────────────────────────────────────────────────────

export interface HistorySectionProps {
  state: HistoryState;
  onRetry: () => void;
}

export function HistorySection({ state, onRetry }: HistorySectionProps) {
  if (state.status === "loading") {
    return (
      <Card>
        <CardContent className="divide-y py-0">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-destructive">
            Unable to load payment history.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state.payments.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No payment history found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {/* Table header */}
      <div className="hidden grid-cols-4 gap-4 border-b px-6 py-3 sm:grid">
        <p className="text-xs font-medium uppercase text-muted-foreground">Date</p>
        <p className="text-xs font-medium uppercase text-muted-foreground col-span-2">Description</p>
        <p className="text-xs font-medium uppercase text-muted-foreground text-right">Amount</p>
      </div>
      <CardContent className="divide-y py-0">
        {state.payments.map((payment) => (
          <div
            key={payment.id}
            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex items-center gap-2 sm:w-28 shrink-0">
              {paymentStatusIcon(payment.status)}
              <p className="text-sm text-muted-foreground">
                {formatDate(payment.createdAt)}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">
                {payment.description}
              </p>
              <p className="text-xs capitalize text-muted-foreground">
                {payment.type}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
              <p className="text-sm font-semibold">
                {formatCurrency(payment.amount, payment.currency)}
              </p>
              <Badge variant={paymentStatusVariant(payment.status)}>
                {payment.status}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

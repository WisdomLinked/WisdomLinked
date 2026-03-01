import { CreditCard } from "lucide-react";

import { type Subscription } from "@/api/paymentApi";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──────────────────────────────────────────────────────────────────

export type SubscriptionState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; subscription: Subscription | null };

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Subscription Section ───────────────────────────────────────────────────

export interface SubscriptionSectionProps {
  state: SubscriptionState;
  onRetry: () => void;
  onCancel: () => Promise<void>;
  cancelling: boolean;
}

export function SubscriptionSection({
  state,
  onRetry,
  onCancel,
  cancelling,
}: SubscriptionSectionProps) {
  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-destructive">
            Unable to load subscription info.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state.subscription === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>You don't have an active subscription.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Choose a plan below to unlock premium features.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { subscription } = state;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Active Subscription
        </CardTitle>
        <CardDescription>Your current plan details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="mt-0.5 font-semibold">{subscription.planId}</p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-0.5 font-semibold capitalize">
              {subscription.status}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}
            </p>
            <p className="mt-0.5 font-semibold">
              {formatDate(subscription.currentPeriodEnd)}
            </p>
          </div>
        </div>

        {subscription.cancelAtPeriodEnd && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">
              Your subscription will end on{" "}
              {formatDate(subscription.currentPeriodEnd)} and will not renew.
            </p>
          </div>
        )}
      </CardContent>

      {!subscription.cancelAtPeriodEnd && (
        <CardFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={cancelling}>
                {cancelling ? "Cancelling..." : "Cancel Subscription"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                <AlertDialogDescription>
                  Your subscription will remain active until the end of the
                  current billing period. After that, it will not renew.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onCancel}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, Cancel
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      )}
    </Card>
  );
}

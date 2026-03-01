import { useEffect, useCallback, useState } from "react";
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
} from "lucide-react";

import {
  paymentApi,
  type Subscription,
  type PricingPlan,
  type Payment,
} from "@/api/paymentApi";
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
import { Separator } from "@/components/ui/separator";
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

// ── Types ──────────────────────────────────────────────────────────────────

type SubscriptionState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; subscription: Subscription | null };

type PlansState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; plans: PricingPlan[] };

type HistoryState =
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

// ── Subscription Section ───────────────────────────────────────────────────

interface SubscriptionSectionProps {
  state: SubscriptionState;
  onRetry: () => void;
  onCancel: () => Promise<void>;
  cancelling: boolean;
}

function SubscriptionSection({
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

// ── Plans Section ──────────────────────────────────────────────────────────

interface PlansSectionProps {
  state: PlansState;
  onRetry: () => void;
  onSubscribe: (planId: string) => Promise<void>;
  subscribingId: string | null;
  currentPlanId: string | null;
}

function PlansSection({
  state,
  onRetry,
  onSubscribe,
  subscribingId,
  currentPlanId,
}: PlansSectionProps) {
  if (state.status === "loading") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-20" />
            </CardHeader>
            <CardContent className="space-y-2">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </CardContent>
            <CardFooter>
              <Skeleton className="h-9 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-destructive">Unable to load plans.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state.plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No pricing plans available at this time.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {state.plans.map((plan) => {
        const isCurrent = plan.id === currentPlanId;
        const isSubscribing = subscribingId === plan.id;

        return (
          <Card key={plan.id} className={isCurrent ? "ring-2 ring-primary" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                {isCurrent && (
                  <Badge variant="default" className="text-xs">
                    Current
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  {formatCurrency(plan.amount, plan.currency)}
                </span>
                {plan.interval && (
                  <span className="text-sm text-muted-foreground">
                    /{plan.interval}
                  </span>
                )}
              </div>
              {plan.description && (
                <CardDescription>{plan.description}</CardDescription>
              )}
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                variant={isCurrent ? "secondary" : "default"}
                disabled={isCurrent || isSubscribing}
                onClick={() => onSubscribe(plan.id)}
              >
                {isSubscribing ? (
                  "Redirecting..."
                ) : isCurrent ? (
                  "Current Plan"
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Subscribe
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

// ── History Section ────────────────────────────────────────────────────────

interface HistorySectionProps {
  state: HistoryState;
  onRetry: () => void;
}

function HistorySection({ state, onRetry }: HistorySectionProps) {
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

// ── Page Component ─────────────────────────────────────────────────────────

export default function CustomerPayments() {
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>(
    { status: "loading" },
  );
  const [plansState, setPlansState] = useState<PlansState>({
    status: "loading",
  });
  const [historyState, setHistoryState] = useState<HistoryState>({
    status: "loading",
  });
  const [cancelling, setCancelling] = useState(false);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  // No synchronous setState before async call — avoids react-hooks/set-state-in-effect.
  const loadSubscription = useCallback(() => {
    paymentApi
      .getUserSubscription()
      .then(({ subscription }) => {
        setSubscriptionState({ status: "ready", subscription });
      })
      .catch(() => {
        setSubscriptionState({ status: "error" });
      });
  }, []);

  const loadPlans = useCallback(() => {
    paymentApi
      .getPricingPlans()
      .then(({ plans }) => {
        setPlansState({ status: "ready", plans });
      })
      .catch(() => {
        setPlansState({ status: "error" });
      });
  }, []);

  const loadHistory = useCallback(() => {
    paymentApi
      .getPaymentHistory()
      .then(({ payments }) => {
        setHistoryState({ status: "ready", payments });
      })
      .catch(() => {
        setHistoryState({ status: "error" });
      });
  }, []);

  useEffect(() => {
    loadSubscription();
    loadPlans();
    loadHistory();
  }, [loadSubscription, loadPlans, loadHistory]);

  const handleCancelSubscription = useCallback(async () => {
    setCancelling(true);
    try {
      await paymentApi.cancelSubscription();
      window.toast({
        title: "Subscription cancelled",
        description: "Your subscription will end at the current period.",
      });
      setSubscriptionState({ status: "loading" });
      loadSubscription();
    } catch {
      window.toast({
        title: "Cancellation failed",
        description: "Unable to cancel subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  }, [loadSubscription]);

  const handleSubscribe = useCallback(
    async (planId: string) => {
      setSubscribingId(planId);
      try {
        const { url } = await paymentApi.createCheckoutSession(
          planId,
          window.location.origin + "/dashboard/customer/payments",
          window.location.origin + "/dashboard/customer/payments",
        );
        window.location.href = url;
      } catch {
        window.toast({
          title: "Checkout failed",
          description: "Unable to start checkout. Please try again.",
          variant: "destructive",
        });
        setSubscribingId(null);
      }
    },
    [],
  );

  const currentPlanId =
    subscriptionState.status === "ready" &&
    subscriptionState.subscription !== null
      ? subscriptionState.subscription.planId
      : null;

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold">Payments</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your subscription and view payment history
        </p>
      </div>

      {/* Subscription */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Your Subscription</h2>
        <SubscriptionSection
          state={subscriptionState}
          onRetry={() => {
            setSubscriptionState({ status: "loading" });
            loadSubscription();
          }}
          onCancel={handleCancelSubscription}
          cancelling={cancelling}
        />
      </section>

      <Separator />

      {/* Pricing Plans */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Pricing Plans</h2>
        <PlansSection
          state={plansState}
          onRetry={() => {
            setPlansState({ status: "loading" });
            loadPlans();
          }}
          onSubscribe={handleSubscribe}
          subscribingId={subscribingId}
          currentPlanId={currentPlanId}
        />
      </section>

      <Separator />

      {/* Payment History */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Payment History</h2>
        <HistorySection
          state={historyState}
          onRetry={() => {
            setHistoryState({ status: "loading" });
            loadHistory();
          }}
        />
      </section>
    </div>
  );
}

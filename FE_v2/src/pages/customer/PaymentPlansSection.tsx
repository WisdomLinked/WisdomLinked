import { CheckCircle, Zap } from "lucide-react";

import { type PricingPlan } from "@/api/paymentApi";
import { Badge } from "@/components/ui/badge";
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

export type PlansState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; plans: PricingPlan[] };

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100); // Stripe amounts are in cents
}

// ── Plans Section ──────────────────────────────────────────────────────────

export interface PlansSectionProps {
  state: PlansState;
  onRetry: () => void;
  onSubscribe: (planId: string) => Promise<void>;
  subscribingId: string | null;
  currentPlanId: string | null;
}

export function PlansSection({
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

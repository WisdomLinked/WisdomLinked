import { useCallback, useEffect, useState } from "react";

import { paymentApi } from "@/api/paymentApi";
import { Separator } from "@/components/ui/separator";

import {
  HistorySection,
  type HistoryState,
} from "./PaymentHistorySection";
import {
  PlansSection,
  type PlansState,
} from "./PaymentPlansSection";
import {
  SubscriptionSection,
  type SubscriptionState,
} from "./PaymentSubscriptionSection";

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

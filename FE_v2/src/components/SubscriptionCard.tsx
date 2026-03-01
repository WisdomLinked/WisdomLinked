import { useEffect, useState } from "react";
import { paymentApi, Subscription } from "../api/paymentApi";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function SubscriptionCard() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  async function loadSubscription() {
    try {
      setLoading(true);
      const data = await paymentApi.getUserSubscription();
      setSubscription(data.subscription);
    } catch (error) {
      console.error("Failed to load subscription:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel your subscription? It will remain active until the end of your billing period.")) {
      return;
    }

    try {
      setCanceling(true);
      await paymentApi.cancelSubscription();
      await loadSubscription();
      alert("Your subscription has been scheduled for cancellation at the end of the billing period.");
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      alert("Failed to cancel subscription. Please try again.");
    } finally {
      setCanceling(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center">Loading subscription...</div>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Subscription</h2>
        <p className="text-gray-600 mb-4">You don't have an active subscription.</p>
        <Button onClick={() => (window.location.href = "/pricing")}>
          View Pricing Plans
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Your Subscription</h2>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="font-medium">Plan:</span>
          <span>{subscription.planId}</span>
        </div>

        <div className="flex justify-between">
          <span className="font-medium">Status:</span>
          <span className="capitalize">{subscription.status}</span>
        </div>

        <div className="flex justify-between">
          <span className="font-medium">Renews:</span>
          <span>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span>
        </div>

        {subscription.cancelAtPeriodEnd && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 text-sm">
              Your subscription will be canceled on{" "}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {!subscription.cancelAtPeriodEnd && (
        <Button
          onClick={handleCancel}
          variant="destructive"
          disabled={canceling}
          className="w-full"
        >
          {canceling ? "Canceling..." : "Cancel Subscription"}
        </Button>
      )}
    </Card>
  );
}

import { useEffect, useState } from "react";
import { paymentApi, PricingPlan } from "../api/paymentApi";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function Pricing() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);
      const data = await paymentApi.getPricingPlans();
      setPlans(data.plans);
      setError(null);
    } catch (err) {
      console.error("Failed to load plans:", err);
      setError("Failed to load pricing plans");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(planId: string) {
    try {
      const { url } = await paymentApi.createCheckoutSession(
        planId,
        `${window.location.origin}/payment/success`,
        `${window.location.origin}/pricing`
      );
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error("Failed to create checkout session:", err);
      alert("Failed to start checkout. Please try again.");
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading pricing plans...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-red-500">{error}</div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">No pricing plans available at this time.</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold text-center mb-4">Choose Your Plan</h1>
      <p className="text-center text-gray-600 mb-12">
        Select the perfect plan for your needs
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <Card key={plan.id} className="p-8 flex flex-col">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
              <p className="text-gray-600 text-sm">{plan.description}</p>
            </div>

            <div className="mb-6">
              <div className="text-4xl font-bold">
                ${(plan.amount / 100).toFixed(2)}
              </div>
              {plan.interval && (
                <div className="text-gray-600">per {plan.interval}</div>
              )}
            </div>

            <ul className="mb-8 space-y-3 flex-grow">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <span className="mr-2 text-green-500 font-bold">✓</span>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button onClick={() => handleSubscribe(plan.id)} className="w-full">
              {plan.type === "subscription" ? "Subscribe Now" : "Buy Now"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

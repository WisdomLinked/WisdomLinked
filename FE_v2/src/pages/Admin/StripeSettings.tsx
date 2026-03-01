import { useEffect, useState } from "react";
import { paymentAdminApi, PricingPlan } from "../../api/paymentApi";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card } from "../../components/ui/card";

export function StripeSettings() {
  const [config, setConfig] = useState({
    publishableKey: "",
    secretKey: "",
    webhookSecret: "",
    enabled: false,
  });
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      setLoading(true);
      const data = await paymentAdminApi.getStripeConfig();
      setConfig(data.config);
      setPlans(data.plans);
    } catch (error) {
      console.error("Failed to load config:", error);
      alert("Failed to load Stripe configuration");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await paymentAdminApi.updateStripeConfig(config);
      alert("Stripe configuration saved successfully");
    } catch (error) {
      console.error("Failed to save config:", error);
      alert("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Stripe Configuration</h1>

      <Card className="p-6 mb-6">
        <h2 className="text-xl font-bold mb-6">API Keys</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Enable Stripe Payments
            </label>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) =>
                  setConfig({ ...config, enabled: e.target.checked })
                }
                className="w-4 h-4 mr-2"
              />
              <span className="text-sm">
                {config.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="publishableKey" className="block text-sm font-medium mb-2">
              Publishable Key
            </label>
            <Input
              id="publishableKey"
              type="text"
              value={config.publishableKey}
              onChange={(e) =>
                setConfig({ ...config, publishableKey: e.target.value })
              }
              placeholder="pk_test_..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Your Stripe publishable key (safe to expose in frontend)
            </p>
          </div>

          <div>
            <label htmlFor="secretKey" className="block text-sm font-medium mb-2">
              Secret Key
            </label>
            <Input
              id="secretKey"
              type="password"
              value={config.secretKey}
              onChange={(e) =>
                setConfig({ ...config, secretKey: e.target.value })
              }
              placeholder="sk_test_..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Your Stripe secret key (never expose to frontend)
            </p>
          </div>

          <div>
            <label htmlFor="webhookSecret" className="block text-sm font-medium mb-2">
              Webhook Secret
            </label>
            <Input
              id="webhookSecret"
              type="password"
              value={config.webhookSecret}
              onChange={(e) =>
                setConfig({ ...config, webhookSecret: e.target.value })
              }
              placeholder="whsec_..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Webhook signing secret from Stripe Dashboard
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="mt-6">
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Pricing Plans</h2>

        {plans.length === 0 ? (
          <p className="text-gray-600">
            No pricing plans configured. Add plans using the Stripe Dashboard
            and update them here.
          </p>
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="p-4 border rounded flex justify-between items-center"
              >
                <div>
                  <h3 className="font-bold">{plan.name}</h3>
                  <p className="text-sm text-gray-600">{plan.description}</p>
                  <p className="text-sm mt-1">
                    ${(plan.amount / 100).toFixed(2)}
                    {plan.interval && ` / ${plan.interval}`}
                  </p>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="text-green-600">Configured</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> To add or modify pricing plans, create them
            in your Stripe Dashboard first, then use the API or this interface
            to sync them with your application.
          </p>
        </div>
      </Card>
    </div>
  );
}

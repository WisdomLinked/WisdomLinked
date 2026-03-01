import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { CreditCard } from "lucide-react";

export function SettingsBilling() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>Review your current plan and subscription status</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/settings/billing/plans">
            <Button variant="outline">Go to Plans & Pricing</Button>
          </Link>
        </CardContent>
      </Card>

      <SubscriptionCard />
    </div>
  );
}

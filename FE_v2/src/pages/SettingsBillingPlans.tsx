import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Receipt } from "lucide-react";

export function SettingsBillingPlans() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Plans & Pricing
          </CardTitle>
          <CardDescription>Explore available plans and update your billing selection</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/pricing">
            <Button>Open Pricing Page</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export function SettingsSecurity() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Password & Authentication
          </CardTitle>
          <CardDescription>Manage credentials and authentication methods</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            Change Password (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

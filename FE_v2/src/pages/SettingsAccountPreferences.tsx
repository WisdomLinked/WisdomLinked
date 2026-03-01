import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SlidersHorizontal } from "lucide-react";

export function SettingsAccountPreferences() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            Preferences
          </CardTitle>
          <CardDescription>Manage personal app preferences and defaults</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Preference controls will appear here as settings are added.</p>
          <p>Planned options include display, notifications, and default landing page.</p>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import { Separator } from "@/components/ui/separator";
import { Save, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayName = (typeof DAYS)[number];

interface DaySchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

type WeekSchedule = Record<DayName, DaySchedule>;

// ── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_SCHEDULE: WeekSchedule = {
  Monday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  Tuesday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  Wednesday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  Thursday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  Friday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  Saturday: { enabled: false, startTime: "10:00", endTime: "14:00" },
  Sunday: { enabled: false, startTime: "10:00", endTime: "14:00" },
};

// ── Page ──────────────────────────────────────────────────────────────────

export default function ExpertAvailability() {
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);

  const updateDay = (day: DayName, patch: Partial<DaySchedule>) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    // Availability API not yet available — placeholder save
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
    setSaving(false);
    window.toast({
      title: "Availability saved",
      description: "Your weekly schedule has been updated.",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Availability</h1>
        <p className="text-muted-foreground mt-1">
          Set your weekly availability schedule
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* ── Schedule editor ── */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>
                Toggle days on/off and set your available hours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {DAYS.map((day, idx) => {
                const d = schedule[day];
                return (
                  <div key={day}>
                    <div className="flex items-center gap-4 py-4">
                      <div className="w-28 shrink-0">
                        <Label htmlFor={`switch-${day}`} className="font-medium">
                          {day}
                        </Label>
                      </div>
                      <Switch
                        id={`switch-${day}`}
                        checked={d.enabled}
                        onCheckedChange={(checked) =>
                          updateDay(day, { enabled: checked })
                        }
                      />
                      {d.enabled ? (
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                          <TimePicker
                            value={d.startTime}
                            onChange={(t) =>
                              updateDay(day, { startTime: t })
                            }
                          />
                          <span className="text-muted-foreground text-sm">
                            to
                          </span>
                          <TimePicker
                            value={d.endTime}
                            onChange={(t) => updateDay(day, { endTime: t })}
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground flex-1">
                          Unavailable
                        </span>
                      )}
                    </div>
                    {idx < DAYS.length - 1 && <Separator />}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* ── Preview panel ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Schedule Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {DAYS.map((day) => {
                const d = schedule[day];
                return (
                  <div
                    key={day}
                    className="flex items-center justify-between text-sm"
                  >
                    <span
                      className={cn(
                        "font-medium",
                        !d.enabled && "text-muted-foreground"
                      )}
                    >
                      {day.slice(0, 3)}
                    </span>
                    {d.enabled ? (
                      <span className="text-muted-foreground text-xs">
                        {d.startTime} – {d.endTime}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Off
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Availability"}
          </Button>
        </div>
      </div>
    </div>
  );
}

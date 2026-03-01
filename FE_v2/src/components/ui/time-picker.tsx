import * as React from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ── Pure helpers ──────────────────────────────────────────────────────────

function padZero(n: number): string {
  return n.toString().padStart(2, "0");
}

const HOURS: ReadonlyArray<string> = Array.from({ length: 24 }, (_, i) => padZero(i));
const MINUTES: ReadonlyArray<string> = Array.from({ length: 60 }, (_, i) => padZero(i));

const ITEM_HEIGHT_PX = 32;
const VISIBLE_ITEMS = 6; // show ~6 items before scrolling

function parseTimeParts(time: string | undefined): { hour: string; minute: string } {
  if (time === undefined) return { hour: "00", minute: "00" };
  const colonIdx = time.indexOf(":");
  if (colonIdx === -1) return { hour: "00", minute: "00" };
  const h = time.slice(0, colonIdx).padStart(2, "0");
  const m = time.slice(colonIdx + 1, colonIdx + 3).padStart(2, "0");
  return { hour: h, minute: m };
}

// ── Component ─────────────────────────────────────────────────────────────

export interface TimePickerProps {
  value?: string; // HH:MM format
  onChange?: (time: string) => void;
  disabled?: boolean;
  className?: string;
}

const TimePicker = React.forwardRef<HTMLButtonElement, TimePickerProps>(
  ({ value, onChange, disabled, className }, ref) => {
    const [open, setOpen] = React.useState(false);

    const { hour: selectedHour, minute: selectedMinute } = React.useMemo(
      () => parseTimeParts(value),
      [value],
    );

    const hourScrollRef = React.useRef<HTMLDivElement>(null);
    const minuteScrollRef = React.useRef<HTMLDivElement>(null);

    // Scroll to the selected position whenever the popover opens or the
    // selection changes while the picker is open. All consumed values are
    // explicit deps so the rule of hooks is fully satisfied.
    React.useEffect(() => {
      if (!open) return;

      const id = setTimeout(() => {
        const hEl = hourScrollRef.current;
        const mEl = minuteScrollRef.current;

        if (hEl) {
          const hIdx = HOURS.indexOf(selectedHour);
          const targetIdx = hIdx >= 0 ? hIdx : 0;
          hEl.scrollTop = Math.max(0, targetIdx * ITEM_HEIGHT_PX - ITEM_HEIGHT_PX);
        }
        if (mEl) {
          const mIdx = MINUTES.indexOf(selectedMinute);
          const targetIdx = mIdx >= 0 ? mIdx : 0;
          mEl.scrollTop = Math.max(0, targetIdx * ITEM_HEIGHT_PX - ITEM_HEIGHT_PX);
        }
      }, 50);

      return () => clearTimeout(id);
    }, [open, selectedHour, selectedMinute]);

    const handleHourSelect = (h: string) => {
      onChange?.(`${h}:${selectedMinute}`);
    };

    const handleMinuteSelect = (m: string) => {
      onChange?.(`${selectedHour}:${m}`);
    };

    const listHeight = VISIBLE_ITEMS * ITEM_HEIGHT_PX;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              value === undefined && "text-muted-foreground",
              className,
            )}
          >
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            {value !== undefined ? (
              <span>{value}</span>
            ) : (
              <span>Pick a time</span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex gap-2">
            {/* Hours column */}
            <div className="flex flex-col items-center gap-1">
              <span className="mb-1 text-xs font-medium text-muted-foreground">HH</span>
              <div
                ref={hourScrollRef}
                style={{ height: listHeight }}
                className="w-14 overflow-y-auto custom-scrollbar rounded-md"
              >
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHourSelect(h)}
                    className={cn(
                      "flex h-8 w-full items-center justify-center rounded text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      selectedHour === h &&
                        "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Separator */}
            <div className="flex items-center pt-6 text-lg font-medium text-muted-foreground">
              :
            </div>

            {/* Minutes column */}
            <div className="flex flex-col items-center gap-1">
              <span className="mb-1 text-xs font-medium text-muted-foreground">MM</span>
              <div
                ref={minuteScrollRef}
                style={{ height: listHeight }}
                className="w-14 overflow-y-auto custom-scrollbar rounded-md"
              >
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinuteSelect(m)}
                    className={cn(
                      "flex h-8 w-full items-center justify-center rounded text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      selectedMinute === m &&
                        "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Current value display */}
          <div className="mt-3 border-t pt-2 text-center text-sm font-mono text-muted-foreground">
            {selectedHour}:{selectedMinute}
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);
TimePicker.displayName = "TimePicker";

export { TimePicker };

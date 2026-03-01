import * as React from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ── Pure calendar helpers (no I/O, no globals) ───────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Build an array of (day | null) cells for a month grid.
// null values represent empty slots before the first day.
function buildCalendarCells(year: number, month: number): Array<number | null> {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells: Array<number | null> = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }
  return cells;
}

// ── Component ─────────────────────────────────────────────────────────────

export interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  ({ value, onChange, placeholder = "Pick a date", disabled, className }, ref) => {
    const today = React.useMemo(() => new Date(), []);

    const [open, setOpen] = React.useState(false);
    const [viewYear, setViewYear] = React.useState<number>(
      value !== undefined ? value.getFullYear() : today.getFullYear(),
    );
    const [viewMonth, setViewMonth] = React.useState<number>(
      value !== undefined ? value.getMonth() : today.getMonth(),
    );

    // When value changes externally and popover is closed, update the view
    React.useEffect(() => {
      if (!open && value !== undefined) {
        setViewYear(value.getFullYear());
        setViewMonth(value.getMonth());
      }
    }, [value, open]);

    const cells = React.useMemo(() => buildCalendarCells(viewYear, viewMonth), [viewYear, viewMonth]);

    const handlePrevMonth = () => {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear((y) => y - 1);
      } else {
        setViewMonth((m) => m - 1);
      }
    };

    const handleNextMonth = () => {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear((y) => y + 1);
      } else {
        setViewMonth((m) => m + 1);
      }
    };

    const handleSelectDay = (day: number) => {
      const date = new Date(viewYear, viewMonth, day);
      onChange?.(date);
      setOpen(false);
    };

    const isToday = (day: number): boolean =>
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getFullYear() === viewYear;

    const isSelected = (day: number): boolean => {
      if (value === undefined) return false;
      return (
        value.getDate() === day &&
        value.getMonth() === viewMonth &&
        value.getFullYear() === viewYear
      );
    };

    const monthLabel = MONTH_NAMES[viewMonth];

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              value === undefined && "text-muted-foreground",
              className,
            )}
          >
            <Calendar className="mr-2 h-4 w-4 shrink-0" />
            {value !== undefined ? formatDate(value) : placeholder}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3">
            {/* Month / Year navigation */}
            <div className="mb-3 flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth} type="button">
                <ChevronLeft />
              </Button>
              <span className="text-sm font-medium">
                {monthLabel} {viewYear}
              </span>
              <Button variant="ghost" size="icon" onClick={handleNextMonth} type="button">
                <ChevronRight />
              </Button>
            </div>

            {/* Day-of-week headers */}
            <div className="mb-1 grid grid-cols-7">
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-xs text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Calendar day cells */}
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => (
                <div key={idx} className="flex items-center justify-center">
                  {day !== null ? (
                    <button
                      type="button"
                      onClick={() => handleSelectDay(day)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        isToday(day) && !isSelected(day) && "bg-accent text-accent-foreground",
                        isSelected(day) &&
                          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                      )}
                    >
                      {day}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);
DatePicker.displayName = "DatePicker";

export { DatePicker };

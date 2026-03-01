import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ── Types ─────────────────────────────────────────────────────────────────

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  value?: string[];
  onChange?: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────

const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  (
    {
      options,
      value: selectedValues = [],
      onChange,
      placeholder = "Select options...",
      disabled,
      className,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    const filteredOptions = React.useMemo(
      () =>
        options.filter((opt) =>
          opt.label.toLowerCase().includes(search.toLowerCase()),
        ),
      [options, search],
    );

    const selectedOptions = React.useMemo(
      () => options.filter((opt) => selectedValues.includes(opt.value)),
      [options, selectedValues],
    );

    const handleToggle = (optionValue: string) => {
      if (selectedValues.includes(optionValue)) {
        onChange?.(selectedValues.filter((v) => v !== optionValue));
      } else {
        onChange?.([...selectedValues, optionValue]);
      }
    };

    const handleRemovePill = (e: React.MouseEvent<HTMLButtonElement>, optionValue: string) => {
      e.stopPropagation();
      onChange?.(selectedValues.filter((v) => v !== optionValue));
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    };

    // Clear search when popover closes
    React.useEffect(() => {
      if (!open) setSearch("");
    }, [open]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            disabled={disabled}
            className={cn(
              "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
          >
            {selectedOptions.length > 0 ? (
              <>
                {selectedOptions.map((opt) => (
                  <span
                    key={opt.value}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                  >
                    {opt.label}
                    <button
                      type="button"
                      onClick={(e) => handleRemovePill(e, opt.value)}
                      className="rounded-full transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label={`Remove ${opt.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <ChevronDown className="ml-auto h-4 w-4 shrink-0 self-center opacity-50" />
              </>
            ) : (
              <>
                <span className="text-muted-foreground">{placeholder}</span>
                <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
              </>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="min-w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          {/* Search input */}
          <div className="border-b p-2">
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search..."
              className={cn(
                "flex h-8 w-full rounded-md bg-transparent px-2 py-1 text-sm outline-none",
                "placeholder:text-muted-foreground",
              )}
            />
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-sm text-muted-foreground">
                No options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleToggle(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isSelected && "font-medium",
                    )}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground bg-transparent",
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="flex-1 text-left">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Selected count footer */}
          {selectedValues.length > 0 && (
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              {selectedValues.length} selected
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  },
);
MultiSelect.displayName = "MultiSelect";

export { MultiSelect };

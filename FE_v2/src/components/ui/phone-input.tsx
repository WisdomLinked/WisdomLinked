import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ── Country data ──────────────────────────────────────────────────────────

interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { code: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽" },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸" },
  { code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱" },
  { code: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴" },
  { code: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷" },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
  { code: "AE", name: "UAE", dialCode: "+971", flag: "🇦🇪" },
];

const FALLBACK_COUNTRY: Country = {
  code: "US",
  name: "United States",
  dialCode: "+1",
  flag: "🇺🇸",
};

function findCountryByCode(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? FALLBACK_COUNTRY;
}

// Strip a leading dial code from a phone string (if present) to get the
// local number portion. Returns the input unchanged if not prefixed.
function stripDialCode(phone: string, dialCode: string): string {
  if (phone.startsWith(dialCode)) {
    return phone.slice(dialCode.length).replace(/^\s+/, "");
  }
  return phone;
}

// ── Component ─────────────────────────────────────────────────────────────

export interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  defaultCountry?: string;
  disabled?: boolean;
  className?: string;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, defaultCountry = "US", disabled, className }, ref) => {
    const [open, setOpen] = React.useState(false);

    const [selectedCountry, setSelectedCountry] = React.useState<Country>(() =>
      findCountryByCode(defaultCountry),
    );

    // Initialize number part by stripping dial code from initial value
    const [numberPart, setNumberPart] = React.useState<string>(() => {
      if (value === undefined) return "";
      return stripDialCode(value, findCountryByCode(defaultCountry).dialCode);
    });

    // Sync number part when controlled value changes externally.
    // We only strip if the value starts with the current dial code.
    React.useEffect(() => {
      if (value === undefined) return;
      setNumberPart(stripDialCode(value, selectedCountry.dialCode));
    }, [value, selectedCountry.dialCode]);

    const handleCountrySelect = (country: Country) => {
      setSelectedCountry(country);
      setOpen(false);
      const combined = [country.dialCode, numberPart].filter((s) => s.length > 0).join(" ");
      onChange?.(combined);
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Allow digits, spaces, hyphens, dots, parentheses
      const raw = e.target.value.replace(/[^0-9\s\-().]/g, "");
      setNumberPart(raw);
      const combined = [selectedCountry.dialCode, raw].filter((s) => s.length > 0).join(" ");
      onChange?.(combined);
    };

    return (
      <div className={cn("flex", className)}>
        {/* Country selector */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1 rounded-l-md border border-r-0 border-input bg-transparent px-2 text-sm shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "hover:bg-accent hover:text-accent-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              aria-label="Select country code"
            >
              <span role="img" aria-label={selectedCountry.name}>
                {selectedCountry.flag}
              </span>
              <span className="text-xs text-muted-foreground">{selectedCountry.dialCode}</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>

          <PopoverContent className="w-64 p-1" align="start">
            <div className="max-h-52 overflow-y-auto custom-scrollbar">
              {COUNTRIES.map((country) => {
                const isActive = selectedCountry.code === country.code;
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isActive && "bg-accent",
                    )}
                  >
                    <span role="img" aria-label={country.name}>
                      {country.flag}
                    </span>
                    <span className="flex-1 text-left">{country.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {country.dialCode}
                    </span>
                    {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Phone number input */}
        <input
          ref={ref}
          type="tel"
          value={numberPart}
          onChange={handleNumberChange}
          disabled={disabled}
          placeholder="Phone number"
          className={cn(
            "flex h-9 min-w-0 flex-1 rounded-r-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      </div>
    );
  },
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };

import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type InputHTMLAttributes,
  type MutableRefObject,
} from 'react';
import { getExampleNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import PhoneInput, {
  getCountryCallingCode,
  isSupportedCountry,
  type Country,
  type FlagProps,
  type Value,
} from 'react-phone-number-input';
import Select from 'react-select';
import { ChevronDown } from 'lucide-react';
import CountryFlag from './CountryFlag';
import { OptionRow, optionClass } from './SearchableSelect';
import { isBareCallingCode, phoneDigits } from '../../utils/phone';

type PhoneFieldContextValue = {
  /** Example number shown after the locked calling code while no digits are typed. */
  ghost: { prefix: string; rest: string } | null;
  setValue: (e164: string) => void;
  /** Moves typed national digits to the new country; returns false when there are none. */
  swapCountry: (country: Country) => boolean;
  inputRef: MutableRefObject<HTMLInputElement | null>;
};

const PhoneFieldContext = createContext<PhoneFieldContextValue>({
  ghost: null,
  setValue: () => {},
  swapCountry: () => false,
  inputRef: { current: null },
});

type CountryOption = { value: Country; label: string; search: string };

type CountrySelectProps = {
  value?: Country;
  options: Array<{ value?: Country; label: string; divider?: boolean }>;
  onChange: (value?: Country) => void;
  iconComponent: ElementType;
  disabled?: boolean;
  readOnly?: boolean;
};

const Flag = ({ country }: FlagProps) => <CountryFlag code={country} size="md" />;
const NoFlag = () => <CountryFlag size="md" />;

function PhoneCountrySelect({
  value,
  options,
  onChange,
  iconComponent: Icon,
  disabled,
  readOnly,
}: CountrySelectProps) {
  const { swapCountry } = useContext(PhoneFieldContext);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const items = useMemo<CountryOption[]>(
    () =>
      options.flatMap((o) =>
        o.value && !o.divider
          ? [{ value: o.value, label: o.label, search: `${o.label} +${getCountryCallingCode(o.value)}` }]
          : [],
      ),
    [options],
  );
  const selected = items.find((o) => o.value === value) ?? null;

  return (
    <div className="relative flex shrink-0">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || readOnly}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Phone country: ${selected?.label ?? 'International'}`}
        onMouseDown={(e) => {
          if (open) e.preventDefault();
        }}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-full items-center gap-1.5 rounded-l-xl border-r border-slate-200 bg-slate-50 px-3 outline-none transition hover:bg-slate-100 focus-visible:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon country={value} label={selected?.label ?? 'International'} />
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <Select<CountryOption, false>
            unstyled
            maxMenuHeight={288}
            autoFocus
            menuIsOpen
            aria-label="Search country"
            placeholder="Search country"
            options={items}
            value={selected}
            getOptionLabel={(o) => o.search}
            getOptionValue={(o) => o.value}
            formatOptionLabel={(o) => (
              <span className="flex items-center gap-2.5">
                <CountryFlag code={o.value} size="md" />
                <span className="min-w-0 truncate">{o.label}</span>
                <span className="text-slate-400">+{getCountryCallingCode(o.value)}</span>
              </span>
            )}
            controlShouldRenderValue={false}
            hideSelectedOptions={false}
            tabSelectsValue={false}
            backspaceRemovesValue={false}
            menuShouldScrollIntoView={false}
            onChange={(o) => {
              setOpen(false);
              if (o && o.value !== value && !swapCountry(o.value)) onChange(o.value);
            }}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                buttonRef.current?.focus();
              }
            }}
            styles={{ menu: (base) => ({ ...base, position: 'static' }) }}
            classNames={{
              control: ({ isFocused }) =>
                `min-h-9 h-9 rounded-lg border px-3 text-sm ${
                  isFocused ? 'border-[#234C6A] bg-white' : 'border-slate-200 bg-slate-50'
                }`,
              placeholder: () => 'text-slate-400',
              input: () => 'text-slate-900',
              menu: () => 'mt-1.5',
              menuList: () => 'scrollbar-thin overflow-y-auto py-1 pr-1',
              option: optionClass,
              noOptionsMessage: () => 'px-3 py-2 text-sm text-slate-500',
            }}
            components={{ Option: OptionRow, DropdownIndicator: null, IndicatorSeparator: null }}
            noOptionsMessage={() => 'No results'}
          />
        </div>
      ) : null}
    </div>
  );
}

const NumberInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function NumberInput({ onPaste, ...props }, ref) {
    const { ghost, setValue, inputRef } = useContext(PhoneFieldContext);
    return (
      <span className="relative flex min-w-0 flex-1">
        <input
          ref={(el) => {
            inputRef.current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) ref.current = el;
          }}
          {...props}
          onPaste={(e) => {
            // The locked calling code would otherwise swallow a pasted "+44…" as national digits.
            const text = e.clipboardData.getData('text').trim();
            const digits = /^(\+|00)/.test(text) ? phoneDigits(text.replace(/^00/, '')) : '';
            if (digits) {
              e.preventDefault();
              setValue(`+${digits}`);
              return;
            }
            onPaste?.(e);
          }}
        />
        {ghost ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-3 text-base"
          >
            <span className="whitespace-pre">
              <span className="invisible">{ghost.prefix}</span>
              <span className="text-slate-400">{ghost.rest}</span>
            </span>
          </span>
        ) : null}
      </span>
    );
  },
);

const exampleGhost = (country: Country) => {
  const prefix = `+${getCountryCallingCode(country)}`;
  const example = getExampleNumber(country, examples)?.formatInternational();
  return example?.startsWith(prefix) ? { prefix, rest: example.slice(prefix.length) } : null;
};

const nationalDigits = (value: string, country: Country) => {
  const parsed = parsePhoneNumberFromString(value);
  if (parsed) return parsed.nationalNumber as string;
  const prefix = `+${getCountryCallingCode(country)}`;
  return value.startsWith(prefix) ? value.slice(prefix.length) : '';
};

type PhoneFieldProps = {
  /** E.164, e.g. "+15454545454"; empty string when blank. */
  value: string;
  onChange: (value: string) => void;
  /** Selected phone country (ISO 3166-1 alpha-2); independent of the profile Country field. */
  country?: string;
  onCountryChange: (country: Country) => void;
  invalid?: boolean;
  'aria-label'?: string;
};

export default function PhoneField({
  value,
  onChange,
  country,
  onCountryChange,
  invalid = false,
  'aria-label': ariaLabel = 'Phone number',
}: PhoneFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const iso = country?.toUpperCase();
  const selected: Country = iso && isSupportedCountry(iso) ? iso : 'US';

  const context = useMemo<PhoneFieldContextValue>(
    () => ({
      ghost: value ? null : exampleGhost(selected),
      setValue: onChange,
      swapCountry: (next) => {
        const national = value ? nationalDigits(value, selected) : '';
        if (!national) return false;
        onCountryChange(next);
        onChange(`+${getCountryCallingCode(next)}${national}`);
        inputRef.current?.focus();
        return true;
      },
      inputRef,
    }),
    [value, selected, onChange, onCountryChange],
  );

  return (
    <PhoneFieldContext.Provider value={context}>
      <PhoneInput
        value={(value || undefined) as Value | undefined}
        onChange={(next) => onChange(!next || isBareCallingCode(next) ? '' : next)}
        defaultCountry={selected}
        onCountryChange={(next) => {
          if (next) onCountryChange(next);
        }}
        international
        countryCallingCodeEditable={false}
        focusInputOnCountrySelection
        flagComponent={Flag}
        internationalIcon={NoFlag}
        countrySelectComponent={PhoneCountrySelect}
        inputComponent={NumberInput}
        aria-label={ariaLabel}
        numberInputProps={{
          className:
            'h-full w-full min-w-0 rounded-r-xl bg-transparent px-3 text-base text-slate-900 outline-none',
        }}
        className={`flex h-11 w-full items-stretch rounded-xl border bg-slate-50 transition focus-within:border-[#234C6A] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#234C6A]/15 ${
          invalid ? 'border-rose-300' : 'border-slate-200 hover:border-slate-300'
        }`}
      />
    </PhoneFieldContext.Provider>
  );
}

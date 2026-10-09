import Select, {
  components,
  type ClearIndicatorProps,
  type DropdownIndicatorProps,
  type GroupBase,
  type OptionProps,
  type Props as SelectProps,
  type StylesConfig,
} from 'react-select';
import { Check, ChevronDown } from 'lucide-react';

type SearchableSelectProps<Option> = {
  options: readonly Option[];
  value: Option | null;
  onChange: (value: Option | null) => void;
  placeholder?: string;
  isDisabled?: boolean;
  isSearchable?: boolean;
  hasError?: boolean;
  'aria-label'?: string;
  onBlur?: () => void;
  getOptionLabel?: (option: Option) => string;
  getOptionValue?: (option: Option) => string;
  formatOptionLabel?: SelectProps<Option, false>['formatOptionLabel'];
  className?: string;
  /** Extra classes for the visible control box. */
  controlClassName?: string;
  inputId?: string;
};

function DropdownIndicator<Option>(
  props: DropdownIndicatorProps<Option, false, GroupBase<Option>>,
) {
  const open = props.selectProps.menuIsOpen;
  return (
    <components.DropdownIndicator {...props}>
      <ChevronDown
        className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        aria-hidden
      />
    </components.DropdownIndicator>
  );
}

function ClearIndicator<Option>(
  props: ClearIndicatorProps<Option, false, GroupBase<Option>>,
) {
  return (
    <components.ClearIndicator {...props}>
      <span className="px-0.5 text-sm leading-none text-slate-400 hover:text-slate-600">×</span>
    </components.ClearIndicator>
  );
}

export function OptionRow<Option>(props: OptionProps<Option, false, GroupBase<Option>>) {
  return (
    <components.Option {...props}>
      <div className="flex w-full items-center justify-between gap-2">
        <span className="min-w-0 truncate">{props.children}</span>
        {props.isSelected ? (
          <Check className="h-4 w-4 shrink-0 text-[#234C6A]" aria-hidden />
        ) : null}
      </div>
    </components.Option>
  );
}

export const optionClass = ({ isFocused, isSelected }: { isFocused: boolean; isSelected: boolean }) =>
  [
    'cursor-pointer rounded-lg px-3 py-2 text-sm',
    isSelected ? 'font-medium text-[#234C6A]' : 'text-slate-800',
    isFocused && !isSelected ? 'bg-[#234C6A]/[0.08] text-[#234C6A]' : '',
    isFocused && isSelected ? 'bg-[#234C6A]/[0.08]' : '',
  ]
    .filter(Boolean)
    .join(' ');

/**
 * Brand-styled searchable select (react-select unstyled + Tailwind).
 * Matches Expert Profile input height/radius/focus.
 */
export default function SearchableSelect<Option>({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  isDisabled = false,
  isSearchable = true,
  hasError = false,
  'aria-label': ariaLabel,
  onBlur,
  getOptionLabel,
  getOptionValue,
  formatOptionLabel,
  className = '',
  controlClassName = '',
  inputId,
}: SearchableSelectProps<Option>) {
  return (
    <Select<Option, false>
      unstyled
      maxMenuHeight={288}
      inputId={inputId}
      aria-label={ariaLabel}
      options={options as Option[]}
      value={value}
      onChange={(next) => onChange(next)}
      onBlur={onBlur}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isSearchable={isSearchable}
      isClearable={false}
      getOptionLabel={getOptionLabel}
      getOptionValue={getOptionValue}
      formatOptionLabel={formatOptionLabel}
      styles={{} as StylesConfig<Option, false>}
      className={className}
      classNames={{
        control: ({ isFocused }) =>
          [
            'min-h-11 h-11 rounded-xl border bg-slate-50 px-3.5 text-[15px] text-slate-900 transition',
            hasError ? 'border-rose-300' : 'border-slate-200',
            isFocused
              ? 'border-[#234C6A] bg-white ring-2 ring-[#234C6A]/15'
              : 'hover:border-slate-300',
            isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            controlClassName,
          ].join(' '),
        valueContainer: () => 'gap-1 py-0',
        placeholder: () => 'text-slate-400',
        singleValue: () => 'text-slate-900',
        input: () => 'text-slate-900',
        indicatorsContainer: () => 'gap-0.5',
        indicatorSeparator: () => 'hidden',
        dropdownIndicator: () => 'p-0.5',
        clearIndicator: () => 'p-0.5',
        menu: () =>
          'z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg',
        menuList: () => 'scrollbar-thin overflow-y-auto py-1 pl-1 pr-1.5',
        option: optionClass,
        noOptionsMessage: () => 'px-3 py-2 text-sm text-slate-500',
      }}
      components={{
        DropdownIndicator,
        ClearIndicator,
        IndicatorSeparator: () => null,
        Option: OptionRow,
      }}
      noOptionsMessage={() => 'No results'}
    />
  );
}

import { Country, type ICountry } from 'country-state-city';
import CountryFlag from './CountryFlag';
import SearchableSelect from './SearchableSelect';

export const COUNTRY_REQUIRED_MESSAGE = 'Please select your country';

const COUNTRIES = Country.getAllCountries();

type CountryFieldProps = {
  value: ICountry | null | undefined;
  onChange: (country: ICountry | null) => void;
  onBlur?: () => void;
  error?: boolean;
  disabled?: boolean;
  /** Applied to the search input, so a `<label htmlFor>` can target it. */
  id?: string;
  /** Extra classes for the visible control box. */
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
};

export default function CountryField({
  value,
  onChange,
  onBlur,
  error = false,
  disabled = false,
  id,
  className,
  placeholder = 'Select country',
  'aria-label': ariaLabel = 'Country',
}: CountryFieldProps) {
  return (
    <SearchableSelect<ICountry>
      inputId={id}
      aria-label={ariaLabel}
      options={COUNTRIES}
      value={value ?? null}
      getOptionLabel={(o) => o.name}
      getOptionValue={(o) => o.isoCode}
      formatOptionLabel={(option) => (
        <span className="inline-flex items-center gap-2.5">
          <CountryFlag code={option.isoCode} size="md" />
          {option.name}
        </span>
      )}
      placeholder={placeholder}
      isDisabled={disabled}
      hasError={error}
      onBlur={onBlur}
      onChange={onChange}
      controlClassName={className}
    />
  );
}

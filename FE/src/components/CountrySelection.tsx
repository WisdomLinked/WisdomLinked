import { useEffect, useMemo, useState } from 'react';
import { State, City, type ICountry, type IState, type ICity } from 'country-state-city';
import ShowFieldError from './ShowFieldError';
import CountryField, { COUNTRY_REQUIRED_MESSAGE } from './ui/CountryField';
import FieldLabel from './ui/FieldLabel';
import SearchableSelect from './ui/SearchableSelect';
import { PROFILE_INPUT_CLASS } from './ui/profileFieldStyles';

type CountrySelectProps = {
  selectedCountry: ICountry | null | undefined;
  set_selectedCountry: (c: ICountry | null) => void;
  selectedState: IState | { name: string } | null | undefined;
  set_selectedState: (s: IState | { name: string } | null) => void;
  selectedCity: ICity | null | undefined;
  set_selectedCity: (c: ICity | null) => void;
  stateAvailable: boolean;
  set_stateAvailable: (v: boolean) => void;
  cityAvailable: boolean;
  set_cityAvailable: (v: boolean) => void;
  /** Legacy alias — same as forceShow. */
  showError?: boolean;
  /** Show validation before blur (e.g. after Save). */
  forceShow?: boolean;
};

const US_COUNTY_LEVEL = / (County|Parish|Borough|Census Area)$/;

function citiesOf(state: IState | undefined): ICity[] {
  if (!state?.countryCode || !state?.isoCode) return [];
  const all = City.getCitiesOfState(state.countryCode, state.isoCode) || [];
  return state.countryCode === 'US' ? all.filter((c) => !US_COUNTY_LEVEL.test(c.name)) : all;
}

const CountrySelect = ({
  selectedCountry,
  set_selectedCountry,
  selectedState,
  set_selectedState,
  selectedCity,
  set_selectedCity,
  showError = false,
  forceShow,
  stateAvailable,
  set_stateAvailable,
  cityAvailable,
  set_cityAvailable,
}: CountrySelectProps) => {
  const showForced = forceShow ?? showError;

  const [countryTouched, setCountryTouched] = useState(false);
  const [stateTouched, setStateTouched] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);

  const states = useMemo(
    () => (selectedCountry?.isoCode ? State.getStatesOfCountry(selectedCountry.isoCode) : []),
    [selectedCountry?.isoCode],
  );
  const cities = useMemo(() => citiesOf(selectedState as IState | undefined), [selectedState]);

  useEffect(() => {
    const hasStates = (State.getStatesOfCountry(selectedCountry?.isoCode)?.length ?? 0) > 0;
    set_stateAvailable(hasStates);
    set_cityAvailable(citiesOf(selectedState as IState | undefined).length > 0);
  }, [selectedCountry, selectedState, set_stateAvailable, set_cityAvailable]);

  const countryInvalid = !selectedCountry;
  const stateInvalid = stateAvailable && !selectedState;
  const cityInvalid = cityAvailable && !selectedCity;
  const freeTextState = !stateAvailable && !!selectedCountry;
  const freeTextValue =
    freeTextState && selectedState && 'name' in selectedState ? selectedState.name : '';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <FieldLabel required>Country</FieldLabel>
          <CountryField
            value={selectedCountry}
            error={(countryTouched || showForced) && countryInvalid}
            onBlur={() => setCountryTouched(true)}
            onChange={(item) => {
              set_selectedCountry(item);
              set_selectedState(null);
              set_selectedCity(null);
              setStateTouched(false);
              setCityTouched(false);
            }}
          />
          <ShowFieldError
            show={(countryTouched || showForced) && countryInvalid}
            label={COUNTRY_REQUIRED_MESSAGE}
          />
        </div>

        <div>
          <FieldLabel required={stateAvailable}>State</FieldLabel>
          {freeTextState ? (
            <input
              className={PROFILE_INPUT_CLASS}
              placeholder="State / region (optional)"
              value={freeTextValue}
              onBlur={() => setStateTouched(true)}
              onChange={(e) => {
                const name = e.target.value;
                set_selectedState(name.length ? { name } : null);
              }}
              aria-label="State"
            />
          ) : (
            <SearchableSelect<IState>
              aria-label="State"
              options={states}
              value={(selectedState as IState) ?? null}
              getOptionLabel={(o) => o.name}
              getOptionValue={(o) => o.isoCode}
              placeholder={selectedCountry ? 'Select state' : 'Select a country first'}
              isDisabled={!selectedCountry || !stateAvailable}
              hasError={(stateTouched || showForced) && stateInvalid}
              onBlur={() => setStateTouched(true)}
              onChange={(item) => {
                set_selectedState(item);
                set_selectedCity(null);
                setCityTouched(false);
              }}
            />
          )}
          <ShowFieldError
            show={!freeTextState && (stateTouched || showForced) && stateInvalid}
            label="Please select your state"
          />
        </div>
      </div>

      {cityAvailable ? (
        <div>
          <FieldLabel required>City</FieldLabel>
          <SearchableSelect<ICity>
            aria-label="City"
            options={cities}
            value={selectedCity ?? null}
            getOptionLabel={(o) => o.name}
            getOptionValue={(o) => o.name}
            placeholder="Select city"
            hasError={(cityTouched || showForced) && cityInvalid}
            onBlur={() => setCityTouched(true)}
            onChange={(item) => set_selectedCity(item)}
          />
          <ShowFieldError
            show={(cityTouched || showForced) && cityInvalid}
            label="Please select your city"
          />
        </div>
      ) : null}
    </div>
  );
};

export default CountrySelect;

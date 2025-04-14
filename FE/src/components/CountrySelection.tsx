import Select, { components } from "react-select";
import { Country, State, City, ICountry, IState, ICity } from "country-state-city";
import ShowFieldError from "./ShowFieldError";

const InputOption = ({
    getStyles,
    Icon,
    isDisabled,
    isFocused,
    isSelected,
    children,
    innerProps,
    ...rest
}: any) => {
    // styles
    let bg = "white";
    if (isFocused) bg = "#eee";
    if (isSelected) bg = "#B2D4FF";

    const style = {
        alignItems: "center",
        backgroundColor: bg,
        display: "flex "
    };

    // prop assignment
    const props = {
        ...innerProps,
        style
    };

    return (
        <components.Option
            {...rest}
            isDisabled={isDisabled}
            isFocused={isFocused}
            isSelected={isSelected}
            getStyles={getStyles}
            innerProps={props}
        >
            <span className="text-darkgrey">{children}</span>
        </components.Option>
    );
};


export interface Address {
    country: ICountry | null;
    state: IState | null;
    city: ICity | null;
}

interface CountrySelectProps {
    address: Address;
    on_Change: any;
    validator?: any;
    showError?: boolean;
}

const CountrySelect = ({
    address,
    on_Change,
    validator,
    showError
}: CountrySelectProps) => {


    const availableStates = address.country && State.getStatesOfCountry(address.country.isoCode);
    const availableCities = address.state && City.getCitiesOfState(address.state.countryCode, address.state.isoCode);

    return (
        <>
            <div className="mt-8 text-grey text-[12px] leading-[19px]">Country *</div>
            <Select
                className="w-full rounded-[15px] min-h-[50px] mt-0.5 border text-inherit text-[14px] leading-[21px] py-[5px] border-lightgrey MultiSelection flex flex-col justify-center"
                placeholder='Select country'
                options={Country.getAllCountries()}
                getOptionLabel={(options) => {
                    return options["name"];
                }}
                getOptionValue={(options) => {
                    return options["name"];
                }}
                value={address.country}
                onChange={(country) => on_Change(
                    {
                        ...address,
                        country: country,
                        state: null,
                        city: null
                    }
                )}
                components={{
                    Option: InputOption
                }}
            />
            <ShowFieldError
                show={!address.country}
                label='Select country'
            />

            {
                availableStates?.length ?
                    <>
                        <div className="mt-8 text-grey text-[12px] leading-[19px]">State *</div>
                        <Select
                            className="w-full rounded-[15px] min-h-[50px] mt-0.5 border text-inherit text-[14px] leading-[21px] py-[5px] border-lightgrey MultiSelection flex flex-col justify-center"
                            placeholder='Select state'
                            options={availableStates}
                            getOptionLabel={(options) => {
                                return options["name"];
                            }}
                            getOptionValue={(options) => {
                                return options["name"];
                            }}
                            value={address.state}
                            onChange={(state) => on_Change({ ...address, state: state, city: null })}
                            components={{
                                Option: InputOption
                            }}
                        />
                        <ShowFieldError
                            show={!address.state}
                            label='Select state'
                        />
                    </> :
                    null
            }

            {
                availableCities?.length ?
                    <>
                        <div className="mt-8 text-grey text-[12px] leading-[19px]">City *</div>
                        <Select
                            className="w-full rounded-[15px] min-h-[50px] mt-0.5 border text-inherit text-[14px] leading-[21px] py-[5px] border-lightgrey MultiSelection flex flex-col justify-center"
                            placeholder='Select city'
                            options={availableCities}
                            getOptionLabel={(options: ICity) => {
                                return options["name"];
                            }}
                            getOptionValue={(options) => {
                                return options["name"];
                            }}
                            value={address.city}
                            onChange={(city) => {
                                on_Change({ ...address, city: city });
                            }}
                            components={{
                                Option: InputOption
                            }}
                        />
                        <ShowFieldError
                            show={!address.city}
                            label='Select city'
                        />
                    </> :
                    null
            }
        </>
    );
};

export default CountrySelect
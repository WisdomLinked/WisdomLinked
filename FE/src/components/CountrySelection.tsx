import React, { useEffect, useState } from "react";
import Select, { components } from "react-select";
import { Country, State, City, ICountry, IState } from "country-state-city";
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
const CountrySelect = ({
    selectedCountry,
    set_selectedCountry,
    selectedState,
    set_selectedState,
    selectedCity,
    set_selectedCity,
    showError,
    stateAvailable,
    set_stateAvailable,
    cityAvailable,
    set_cityAvailable
}: any) => {


    const on_countryChange = (country : ICountry) => {
        set_selectedCountry(country);
        set_selectedState(null)
        set_selectedCity(null)
        set_stateAvailable(State.getStatesOfCountry(country?.isoCode)?.length > 0)
    }

    const on_stateChange = (state : IState) => {
        set_selectedState(state);
        set_selectedCity(null)
        set_cityAvailable(City.getCitiesOfState(state?.countryCode, state?.isoCode)?.length > 0)
    }

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
                value={selectedCountry}
                onChange={(item) => {
                    on_countryChange(item)
                }}
                components={{
                    Option: InputOption
                }}
            />
            <ShowFieldError
                show={!selectedCountry && showError}
                label='Select country'
            />

            {
                stateAvailable ?
                    <>
                        <div className="mt-8 text-grey text-[12px] leading-[19px]">State *</div>
                        <Select
                            className="w-full rounded-[15px] min-h-[50px] mt-0.5 border text-inherit text-[14px] leading-[21px] py-[5px] border-lightgrey MultiSelection flex flex-col justify-center"
                            placeholder='Select state'
                            options={State?.getStatesOfCountry(selectedCountry?.isoCode)}
                            getOptionLabel={(options) => {
                                return options["name"];
                            }}
                            getOptionValue={(options) => {
                                return options["name"];
                            }}
                            value={selectedState}
                            onChange={(item) => {
                                on_stateChange(item)
                            }}
                            components={{
                                Option: InputOption
                            }}
                        />
                        <ShowFieldError
                            show={!selectedState && showError}
                            label='Select state'
                        />
                    </> :
                    null
            }

            {
                cityAvailable ?
                    <>
                        <div className="mt-8 text-grey text-[12px] leading-[19px]">City *</div>
                        <Select
                            className="w-full rounded-[15px] min-h-[50px] mt-0.5 border text-inherit text-[14px] leading-[21px] py-[5px] border-lightgrey MultiSelection flex flex-col justify-center"
                            placeholder='Select city'
                            options={City.getCitiesOfState(
                                selectedState?.countryCode,
                                selectedState?.isoCode
                            )}
                            getOptionLabel={(options) => {
                                return options["name"];
                            }}
                            getOptionValue={(options) => {
                                return options["name"];
                            }}
                            value={selectedCity}
                            onChange={(item) => {
                                set_selectedCity(item);
                            }}
                            components={{
                                Option: InputOption
                            }}
                        />
                        <ShowFieldError
                            show={!selectedCity && showError}
                            label='Select city'
                        />
                    </> :
                    null
            }
        </>
    );
};

export default CountrySelect
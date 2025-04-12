import react, { useState } from "react";
import Select, { components } from "react-select";

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

    // Styles
    let bg="white"
    if (isFocused) bg = "#eee";
    // if (isSelected) bg = "#B2D4FF";

    const style = {
        alignItems: "center",
        display: "flex ",
        background: bg,
    };

    // prop assignment
    const props = {
        ...innerProps,
        style,
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
            <input type="checkbox" className="mr-2" defaultChecked={isSelected} checked={isSelected} />
            <span className="text-darkgrey">{children}</span>
        </components.Option>
    );
};

export default function SelectionWithCheckBox({
    options,
    selectedOptions,
    set_selectedOptions,
    placeholder,
    isMulti
}: any) {

    return (
        <Select
            className="w-full rounded-[15px] min-h-[50px] mt-0.5 border text-[14px] leading-[21px] py-[5px] border-lightgrey MultiSelection flex flex-col justify-center"
            placeholder={placeholder || "Select"}
            isMulti={isMulti ? true : false}
            closeMenuOnSelect={false}
            hideSelectedOptions={false}
            onChange={set_selectedOptions}
            options={options}
            value={selectedOptions}
            components={{
                Option: InputOption
            }}
        />
    );
}
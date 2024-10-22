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
    const [isActive, set_isActive] = useState(false);
    const onMouseDown = () => set_isActive(true);
    const onMouseUp = () => set_isActive(false);
    const onMouseLeave = () => set_isActive(false);

    // styles
    let bg = "white";
    if (isFocused) bg = "#eee";
    if (isActive) bg = "#B2D4FF";

    const style = {
        alignItems: "center",
        backgroundColor: bg,
        display: "flex "
    };

    // prop assignment
    const props = {
        ...innerProps,
        onMouseDown,
        onMouseUp,
        onMouseLeave,
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
            <input type="checkbox" className="mr-2" defaultChecked={isSelected} />
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
import React, { useEffect, useState } from "react";
import Select, { components, StylesConfig } from "react-select";

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
    let bg = "#ffffff";
    if (isFocused) bg = "#f8fafc";
    if (isActive) bg = "#E8EEF4";

    const style = {
        alignItems: "center",
        backgroundColor: bg,
        display: "flex",
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
            <span className="text-wl-ink">{children}</span>
        </components.Option>
    );
};

const selectStyles: StylesConfig<any, true> = {
    control: (base, state) => ({
        ...base,
        minHeight: 50,
        borderRadius: 15,
        borderColor: "#DCE4E8",
        backgroundColor: "#ffffff",
        boxShadow: state.isFocused ? "0 0 0 1px #234C6A" : "none",
        "&:hover": {
            borderColor: "#DCE4E8",
        },
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: "#ffffff",
        borderRadius: 12,
        border: "1px solid #DCE4E8",
        boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)",
        overflow: "hidden",
        zIndex: 30,
    }),
    menuList: (base) => ({
        ...base,
        padding: 6,
        backgroundColor: "#ffffff",
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? "#E8EEF4" : state.isFocused ? "#f8fafc" : "#ffffff",
        color: "#1a2d3a",
        cursor: "pointer",
        borderRadius: 8,
    }),
    placeholder: (base) => ({
        ...base,
        color: "#6C7278",
    }),
    input: (base) => ({
        ...base,
        color: "#1a2d3a",
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: "#E8EEF4",
        border: "1px solid #BCD6EA",
        borderRadius: 8,
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: "#234C6A",
        fontWeight: 600,
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: "#234C6A",
        ":hover": {
            backgroundColor: "#D9EAFD",
            color: "#1b3c53",
        },
    }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base) => ({
        ...base,
        color: "#234C6A",
    }),
};

export default function MultiSelectionWithInputTag ({
    options,
    selectedOptions,
    set_selectedOptions,
    placeholder
}:any) {
    const [optionList, set_optionList] = useState<Array<any>>([])

    const handleBlur = (event: any) => {
        const value = event.target.value
        if (value) {
            const isExisting = selectedOptions.find((x:any) => x.value === value.toLowerCase())
            if (!isExisting) {
                const newItem = {
                    value: value.toLowerCase(),
                    label: value,
                    new: true
                }
                set_selectedOptions([...selectedOptions, newItem])
            }
        }
    }

    const handleInputChange = (data:any) => {
        let _optionList = optionList
        if (data) {
            if (_optionList.length && _optionList[0]?.new) {
                const index = optionList.findIndex(x => x.value === data.toLowerCase())
                if (index > -1) {
                    _optionList.splice(0, 1)
                } else {
                    _optionList[0] = {
                        value: data.toLowerCase(),
                        label: data,
                        new: true
                    }
                }
                set_optionList([..._optionList])
            } else {
                set_optionList([
                    {
                        value: data.toLowerCase(),
                        label: data,
                        new: true
                    },
                    ..._optionList
                ])
            }
        } else {
            if (optionList[0]?.new) {
                _optionList.splice(0, 1)
                set_optionList([..._optionList])
            }
        }
    }

    const handleSelect = (options: any) => {
        if (Array.isArray(options)) {
            set_selectedOptions(options.map((opt: any) => opt));
        }
    }

    useEffect(() => {
        set_optionList([...options])
    }, [options])

    return (
        <Select
            className="MultiSelection mt-0.5 flex w-full min-h-[50px] flex-col justify-center rounded-[15px] border-0 py-[5px] text-[14px] leading-[21px] text-wl-ink"
            classNamePrefix="wl-select"
            value={selectedOptions}
            options={[...optionList]}
            placeholder={placeholder || "Select"}
            onChange={handleSelect}
            onInputChange={handleInputChange}
            onBlur={handleBlur}
            isSearchable={true}
            isMulti
            styles={selectStyles}
            components={{
                Option: InputOption
            }}
        />
    );
}
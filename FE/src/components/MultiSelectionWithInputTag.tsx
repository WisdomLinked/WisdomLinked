import react, { useEffect, useState } from "react";
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
            <span className="text-darkgrey">{children}</span>
        </components.Option>
    );
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
            className="w-full rounded-[15px] min-h-[50px] mt-0.5 border text-inherit text-[14px] leading-[21px] py-[5px] border-lightgrey MultiSelection flex flex-col justify-center"
            value={selectedOptions}
            options={[...optionList]}
            placeholder={placeholder || "Select"}
            onChange={handleSelect}
            onInputChange={handleInputChange}
            onBlur={handleBlur}
            isSearchable={true}
            isMulti
            components={{
                Option: InputOption
            }}
        />
    );
}
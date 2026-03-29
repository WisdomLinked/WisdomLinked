import React, { useState } from "react";
import Select, { components, StylesConfig } from "react-select";

const BORDER = "#DCE4E8";
const INK = "#1a2d3a";
const MUTED = "#6C7278";

/** Aligns react-select with white form fields (e.g. admin user management filters). */
const selectStyles: StylesConfig<any, boolean> = {
  control: (base, state) => ({
    ...base,
    minHeight: 50,
    borderRadius: 15,
    borderColor: BORDER,
    backgroundColor: "#ffffff",
    boxShadow: state.isFocused ? "0 0 0 1px #234C6A" : "none",
    "&:hover": {
      borderColor: BORDER,
    },
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
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
    backgroundColor: state.isSelected
      ? "#E8EEF4"
      : state.isFocused
        ? "#f8fafc"
        : "#ffffff",
    color: INK,
    cursor: "pointer",
    borderRadius: 8,
  }),
  singleValue: (base) => ({
    ...base,
    color: INK,
  }),
  placeholder: (base) => ({
    ...base,
    color: MUTED,
  }),
  input: (base) => ({
    ...base,
    color: INK,
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "#234C6A",
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: "#E8EEF4",
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: INK,
  }),
};

const InputOption = ({
  getStyles,
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

  let bg = "#ffffff";
  if (isFocused) bg = "#f8fafc";
  if (isActive) bg = "#E8EEF4";

  const style = {
    alignItems: "center",
    backgroundColor: bg,
    display: "flex",
  };

  const props = {
    ...innerProps,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
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
      <input type="checkbox" className="mr-2" defaultChecked={isSelected} />
      <span className="text-[14px] text-[#1a2d3a]">{children}</span>
    </components.Option>
  );
};

export default function SelectionWithCheckBox({
  options,
  selectedOptions,
  set_selectedOptions,
  placeholder,
  isMulti,
}: any) {
  return (
    <Select
      className="MultiSelection mt-0.5 flex w-full min-h-[50px] flex-col justify-center rounded-[15px] border-0 py-[5px] text-[14px] leading-[21px]"
      classNamePrefix="wl-select"
      placeholder={placeholder || "Select"}
      isMulti={!!isMulti}
      closeMenuOnSelect={false}
      hideSelectedOptions={false}
      onChange={set_selectedOptions}
      options={options}
      value={selectedOptions}
      styles={selectStyles}
      components={{
        Option: InputOption,
      }}
    />
  );
}

import React from 'react';

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Native checkbox in the brand navy used across forms. */
export default function Checkbox({ className = '', ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-[#234C6A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/60 ${className}`}
      {...props}
    />
  );
}

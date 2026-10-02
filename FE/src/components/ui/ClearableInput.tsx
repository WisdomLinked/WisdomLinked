import React, { forwardRef, useRef, useState } from 'react';
import { X } from 'lucide-react';

const CLEAR_BUTTON_PX = 32;
const CLEAR_GUTTER_PX = 4;

/** Shared admin filter control: ~50px tall, 16px type, pill radius, roomy horizontal padding. */
export const FILTER_CONTROL_CLASS =
  'box-border h-[50px] w-full rounded-[15px] border border-lightgrey bg-white px-6 text-base text-wl-ink placeholder:text-grey outline-none focus:outline-none focus:ring-2 focus:ring-wl-brand/30';

export type ClearableInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  wrapperClassName?: string;
  /** `filter` (default) uses FILTER_CONTROL_CLASS. `compact` leaves sizing to className. */
  size?: 'filter' | 'compact';
};

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T) => {
    refs.forEach(ref => {
      if (!ref) return;
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    });
  };
}

const ClearableInput = forwardRef<HTMLInputElement, ClearableInputProps>(function ClearableInput(
  {
    className = '',
    value,
    defaultValue,
    onChange,
    onKeyDown,
    wrapperClassName = 'relative w-full',
    style,
    type = 'text',
    size = 'filter',
    ...rest
  },
  ref,
) {
  const innerRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(String(defaultValue ?? ''));
  const currentValue = isControlled ? String(value) : uncontrolledValue;
  const hasValue = currentValue.length > 0;

  const emitValue = (next: string) => {
    const input = innerRef.current;
    if (!input) return;
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    proto?.set?.call(input, next);
    if (!isControlled) setUncontrolledValue(next);
    const event = {
      target: input,
      currentTarget: input,
    } as React.ChangeEvent<HTMLInputElement>;
    onChange?.(event);
    input.focus();
  };

  const sizeClass = size === 'filter' ? FILTER_CONTROL_CLASS : '';

  return (
    <div className={wrapperClassName}>
      <input
        {...rest}
        ref={mergeRefs(innerRef, ref)}
        type={type}
        value={value}
        defaultValue={defaultValue}
        onChange={e => {
          if (!isControlled) setUncontrolledValue(e.target.value);
          onChange?.(e);
        }}
        onKeyDown={e => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'Escape' && String(e.currentTarget.value).length > 0) {
            e.preventDefault();
            emitValue('');
          }
        }}
        className={`wl-clearable-input ${sizeClass} ${className}`.trim()}
        style={{
          ...style,
          ...(hasValue ? { paddingRight: CLEAR_BUTTON_PX + CLEAR_GUTTER_PX } : null),
        }}
      />
      {hasValue ? (
        <button
          type="button"
          aria-label="Clear"
          className="absolute right-1 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          onMouseDown={e => e.preventDefault()}
          onClick={() => emitValue('')}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      <style>{`
        .wl-clearable-input[type='search']::-webkit-search-cancel-button {
          -webkit-appearance: none;
          appearance: none;
        }
      `}</style>
    </div>
  );
});

export default ClearableInput;

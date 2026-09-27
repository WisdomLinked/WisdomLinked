import type { ReactNode } from 'react';

type FieldLabelProps = {
  children: ReactNode;
  required?: boolean;
  htmlFor?: string;
};

/** Shared profile-field label — sentence case, matches Expert Profile inputs. */
export default function FieldLabel({ children, required, htmlFor }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-medium text-slate-600"
    >
      {children}
      {required ? <span className="ml-0.5 text-rose-400">*</span> : null}
    </label>
  );
}

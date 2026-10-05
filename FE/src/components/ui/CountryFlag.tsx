import type { ComponentType, SVGProps } from 'react';
import * as Flags from 'country-flag-icons/react/3x2';

const SIZE_CLASS = {
  sm: 'h-[15px] w-5',
  md: 'h-[18px] w-6',
} as const;

type Props = {
  /** ISO 3166-1 alpha-2 code, e.g. "US". */
  code?: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
};

const FLAGS = Flags as unknown as Record<string, ComponentType<SVGProps<SVGSVGElement>> | undefined>;

/** Bundled SVG flag; emoji flags don't render on Windows. Unknown codes show a neutral tile. */
export default function CountryFlag({ code, size = 'md', className = '' }: Props) {
  const Flag = code ? FLAGS[code.toUpperCase()] : undefined;
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block shrink-0 overflow-hidden rounded-[3px] bg-slate-200 after:pointer-events-none after:absolute after:inset-0 after:rounded-[3px] after:ring-1 after:ring-inset after:ring-black/10 after:content-[''] ${SIZE_CLASS[size]} ${className}`}
    >
      {Flag ? (
        <Flag preserveAspectRatio="xMidYMid slice" className="block h-full w-full object-cover" />
      ) : null}
    </span>
  );
}

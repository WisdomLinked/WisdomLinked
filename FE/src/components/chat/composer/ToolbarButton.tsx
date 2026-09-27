import type { LucideIcon } from 'lucide-react';

type Props = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  /** Set for toggles (formats, toolbar visibility) so screen readers announce state. */
  pressable?: boolean;
  expanded?: boolean;
  shortcut?: string;
};

export default function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  active = false,
  disabled = false,
  pressable = false,
  expanded,
  shortcut,
}: Props) {
  return (
    <button
      type="button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={pressable ? active : undefined}
      aria-expanded={expanded}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors sm:h-8 sm:w-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 disabled:pointer-events-none disabled:opacity-40 ${
        active ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

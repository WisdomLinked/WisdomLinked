type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  describedBy?: string;
  disabled?: boolean;
};

export default function SettingsSwitch({ checked, onChange, label, describedBy, disabled = false }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
        checked ? 'bg-[#234C6A]' : 'bg-slate-300'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

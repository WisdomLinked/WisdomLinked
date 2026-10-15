import SettingsSwitch from './SettingsSwitch';

type Props = {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  comingSoon?: boolean;
  onChange: (checked: boolean) => void;
};

export default function NotificationOptionRow({
  id,
  label,
  description,
  checked,
  disabled,
  comingSoon = false,
  onChange,
}: Props) {
  const descriptionId = `${id}-description`;
  return (
    <li
      className={`flex items-center justify-between gap-4 py-3.5 transition-opacity ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p id={descriptionId} className="mt-0.5 text-xs text-[#7A7A72]">
          {description}
          {comingSoon ? <span className="mt-0.5 block text-[11px] italic text-slate-400">Coming soon</span> : null}
        </p>
      </div>
      <SettingsSwitch
        checked={checked}
        onChange={onChange}
        label={label}
        describedBy={descriptionId}
        disabled={disabled}
      />
    </li>
  );
}

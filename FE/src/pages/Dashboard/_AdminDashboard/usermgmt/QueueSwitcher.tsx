import { ClipboardCheck, LogIn, Mail, Users, type LucideIcon } from 'lucide-react';

export type QueueOption = {
  value: string;
  label: string;
  hint: string;
};

export const USER_MGMT_QUEUES: QueueOption[] = [
  { value: 'ReviewQueue', label: 'Needs review', hint: 'Approval queue' },
  { value: 'User', label: 'All users', hint: 'Full directory' },
  { value: 'PendingUser', label: 'Pending email verify', hint: 'Unverified signups' },
  { value: 'PendingLogin', label: 'Pending login', hint: 'Unused login codes' },
];

const QUEUE_ICONS: Record<string, LucideIcon> = {
  ReviewQueue: ClipboardCheck,
  User: Users,
  PendingUser: Mail,
  PendingLogin: LogIn,
};

export default function QueueSwitcher({
  value,
  onChange,
}: {
  value: string;
  onChange: (option: QueueOption) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="User management queue"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
    >
      {USER_MGMT_QUEUES.map(option => {
        const selected = option.value === value;
        const Icon = QUEUE_ICONS[option.value] ?? Users;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/40 focus-visible:ring-offset-2 ${
              selected
                ? 'border-wl-brand bg-wl-brand text-white shadow-sm'
                : 'border-wl-line bg-white text-wl-ink hover:border-wl-brand/40 hover:bg-wl-brandSoft/60'
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                selected ? 'bg-white/15 text-white' : 'bg-wl-brandSoft text-wl-brand'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-5">{option.label}</span>
              <span className={`mt-0.5 block text-[11px] leading-4 ${selected ? 'text-white/80' : 'text-wl-muted'}`}>
                {option.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

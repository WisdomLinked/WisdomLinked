import { Globe2 } from 'lucide-react';

const TIME_ZONES = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Australia/Sydney',
];

const SELECT_ID = 'settings-timezone';
const HELP_ID = 'settings-timezone-help';

type Props = {
  value: string;
  onChange: (timeZone: string) => void;
};

export default function TimeZoneField({ value, onChange }: Props) {
  // A detected or saved zone outside the list still needs an option, or the select shows the wrong value.
  const options = TIME_ZONES.includes(value) ? TIME_ZONES : [value, ...TIME_ZONES];

  return (
    <div>
      <div className="flex items-start gap-3">
        <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-[#234C6A]" aria-hidden />
        <div className="min-w-0">
          <label htmlFor={SELECT_ID} className="block text-sm font-semibold text-slate-900">
            Time zone
          </label>
          <p id={HELP_ID} className="mt-0.5 text-xs text-[#7A7A72]">
            Session times show in this zone.
          </p>
        </div>
      </div>
      <select
        id={SELECT_ID}
        aria-describedby={HELP_ID}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#234C6A]/20"
      >
        {options.map(tz => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
    </div>
  );
}

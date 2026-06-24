import React from 'react';
import {
  COMMON_IANA_TIMEZONES,
  detectUserTimeZone,
} from '../../utils/schedulingTimezone';
import type { BookingDisplayTimeZoneMode } from '../../types/scheduling';
import StudentSelect from '../dashboard/StudentSelect';

export type BookingTimeZoneControlProps = {
  mode: BookingDisplayTimeZoneMode;
  customTimeZone: string;
  expertTimeZone: string;
  studentTimeZone?: string;
  onModeChange: (mode: BookingDisplayTimeZoneMode) => void;
  onCustomTimeZoneChange: (tz: string) => void;
  /** student = custom dropdown + student tokens; legacy = native select */
  appearance?: 'student' | 'legacy';
};

const CUSTOM_TZ_TOOLTIP =
  'The system uses your local time automatically unless you choose your own timezone here.';

const BookingTimeZoneControl: React.FC<BookingTimeZoneControlProps> = ({
  mode,
  customTimeZone,
  studentTimeZone,
  onModeChange,
  onCustomTimeZoneChange,
  appearance = 'legacy',
}) => {
  const mine = studentTimeZone || detectUserTimeZone();
  const isStudent = appearance === 'student';

  const tzOptions = COMMON_IANA_TIMEZONES.map((tz) => ({
    value: tz,
    label: tz,
  }));

  return (
    <div
      className={`mb-4 rounded-xl border border-[#E5E2DB] px-3 py-3 ${
        isStudent ? 'bg-[#F5F3EF]' : 'bg-[#F5F3EF]'
      }`}
    >
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A7A72]">
        View times in
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onModeChange('mine')}
          title="Times use your device timezone automatically."
          className={`rounded-[4px] border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            mode === 'mine'
              ? 'border-[#1A3A4A] bg-[#1A3A4A] text-white'
              : 'border-[#E5E2DB] bg-white text-[#1A3A4A] hover:bg-white'
          }`}
        >
          My timezone ({mine})
        </button>
        <button
          type="button"
          onClick={() => onModeChange('custom')}
          title={CUSTOM_TZ_TOOLTIP}
          className={`rounded-[4px] border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            mode === 'custom'
              ? 'border-[#1A3A4A] bg-[#1A3A4A] text-white'
              : 'border-[#E5E2DB] bg-white text-[#1A3A4A] hover:bg-white'
          }`}
        >
          Choose timezone…
        </button>
      </div>
      {mode === 'custom' &&
        (isStudent ? (
          <div className="mt-2" title={CUSTOM_TZ_TOOLTIP}>
            <StudentSelect
              value={customTimeZone || mine}
              options={tzOptions}
              onChange={onCustomTimeZoneChange}
              placeholder="Select timezone"
            />
          </div>
        ) : (
          <select
            value={customTimeZone || mine}
            onChange={(e) => onCustomTimeZoneChange(e.target.value)}
            title={CUSTOM_TZ_TOOLTIP}
            className="mt-2 w-full rounded-lg border border-[#E5E2DB] bg-white px-3 py-2 text-sm text-[#1A3A4A]"
            aria-label="Choose timezone"
          >
            {COMMON_IANA_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        ))}
    </div>
  );
};

export default BookingTimeZoneControl;

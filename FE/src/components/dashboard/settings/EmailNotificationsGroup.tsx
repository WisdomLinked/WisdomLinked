import { useState } from 'react';
import { ChevronDown, Mail } from 'lucide-react';
import NotificationOptionRow from './NotificationOptionRow';
import SettingsSwitch from './SettingsSwitch';
import { EMAIL_OPTIONS, emailSummary, type EmailOptionKey, type SettingsState } from './settingsModel';

type Props = {
  settings: SettingsState;
  onToggleAll: (enabled: boolean) => void;
  onToggleOption: (key: EmailOptionKey, enabled: boolean) => void;
};

const PANEL_ID = 'settings-email-options';
const SUMMARY_ID = 'settings-email-summary';

export default function EmailNotificationsGroup({ settings, onToggleAll, onToggleOption }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={PANEL_ID}
          onClick={() => setOpen(v => !v)}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 focus-visible:ring-offset-2"
        >
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#234C6A]" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">Email notifications</span>
            <span id={SUMMARY_ID} className="mt-0.5 block text-xs text-[#7A7A72]">
              {emailSummary(settings)}
            </span>
          </span>
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-[#7A7A72] transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>
        <SettingsSwitch
          checked={settings.emailEnabled}
          onChange={onToggleAll}
          label="Email notifications"
          describedBy={SUMMARY_ID}
        />
      </div>

      <ul id={PANEL_ID} hidden={!open} className="mt-3 divide-y divide-[#E5E2DB] border-t border-[#E5E2DB] sm:ml-7">
        {EMAIL_OPTIONS.map(option => (
          <NotificationOptionRow
            key={option.key}
            id={`settings-email-${option.key}`}
            label={option.label}
            description={option.description}
            checked={!option.comingSoon && settings.email[option.key]}
            disabled={!settings.emailEnabled || Boolean(option.comingSoon)}
            comingSoon={option.comingSoon}
            onChange={enabled => onToggleOption(option.key, enabled)}
          />
        ))}
      </ul>
    </div>
  );
}

import React, { useState } from 'react';
import { Bell, Globe2, Shield, Mail, Smartphone, Moon } from 'lucide-react';

export default function StudentSettings() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [seminarReminders, setSeminarReminders] = useState(true);
  const [sessionReminders, setSessionReminders] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [timeZone, setTimeZone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const [saveMessage, setSaveMessage] = useState('');

  const cardClass =
    'rounded-2xl border border-[#E5E2DB] bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]';

  const toggleClass = (enabled: boolean) =>
    `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      enabled ? 'bg-[#234C6A]' : 'bg-slate-300'
    }`;

  const handleSave = () => {
    setSaveMessage('Settings saved successfully.');
    window.setTimeout(() => setSaveMessage(''), 2200);
  };

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF] px-6 py-7">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-[#7A7A72]">
          Manage notifications, time zone, and account preferences.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cardClass}>
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#234C6A]" aria-hidden />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
              Notifications
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                label: 'Email notifications',
                hint: 'Get updates for bookings and approvals by email.',
                enabled: emailNotifications,
                setEnabled: setEmailNotifications,
                icon: <Mail className="h-4 w-4 text-[#7A7A72]" aria-hidden />,
              },
              {
                label: 'Push notifications',
                hint: 'Receive in-app reminders and quick alerts.',
                enabled: pushNotifications,
                setEnabled: setPushNotifications,
                icon: <Smartphone className="h-4 w-4 text-[#7A7A72]" aria-hidden />,
              },
              {
                label: 'Seminar reminders',
                hint: 'Remind me before upcoming seminar sessions.',
                enabled: seminarReminders,
                setEnabled: setSeminarReminders,
                icon: <Bell className="h-4 w-4 text-[#7A7A72]" aria-hidden />,
              },
              {
                label: '1:1 session reminders',
                hint: 'Remind me before upcoming 1:1 appointments.',
                enabled: sessionReminders,
                setEnabled: setSessionReminders,
                icon: <Bell className="h-4 w-4 text-[#7A7A72]" aria-hidden />,
              },
              {
                label: 'Product & newsletter emails',
                hint: 'Receive product updates and feature announcements.',
                enabled: marketingEmails,
                setEnabled: setMarketingEmails,
                icon: <Mail className="h-4 w-4 text-[#7A7A72]" aria-hidden />,
              },
            ].map(item => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-3 rounded-xl border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    {item.icon}
                    <span>{item.label}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-[#7A7A72]">{item.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => item.setEnabled((v: boolean) => !v)}
                  className={toggleClass(item.enabled)}
                  aria-pressed={item.enabled}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      item.enabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <div className="mb-4 flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-[#234C6A]" aria-hidden />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
              Regional & Preferences
            </h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Time zone
              </label>
              <select
                value={timeZone}
                onChange={e => setTimeZone(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#234C6A]/20"
              >
                {[
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
                ].map(tz => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[#7A7A72]">
                All session times will be displayed in this zone.
              </p>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-xl border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <Moon className="h-4 w-4 text-[#7A7A72]" aria-hidden />
                  <span>Dark mode (beta testing)</span>
                </p>
                <p className="mt-0.5 text-xs text-[#7A7A72]">
                  Enable dark appearance for dashboard surfaces.
                </p>
              </div>
              <button
                type="button"
                disabled
                className={`${toggleClass(false)} cursor-not-allowed opacity-60`}
                aria-pressed={darkMode}
                aria-disabled="true"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    false ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="rounded-xl border border-[#E5E2DB] bg-white px-3 py-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Shield className="h-4 w-4 text-[#7A7A72]" aria-hidden />
                <span>Security</span>
              </p>
              <p className="mt-1 text-xs text-[#7A7A72]">
                Use profile section password tools for OTP-based password changes.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-[4px] bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          Save settings
        </button>
        {saveMessage ? (
          <p className="text-sm font-semibold text-emerald-700">{saveMessage}</p>
        ) : null}
      </div>
    </div>
  );
}


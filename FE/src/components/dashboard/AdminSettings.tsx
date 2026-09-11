import React, { useEffect, useState } from 'react';
import { Bell, Globe2, Shield, Mail, Smartphone } from 'lucide-react';
import { useAppSelector } from '../../store';
import { doUpdateProfile } from '../../api/api';
import { detectUserTimeZone } from '../../utils/schedulingTimezone';

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

/** Slim admin settings: timezone + notification prefs (no student booking / dark-mode UI). */
export default function AdminSettings() {
  const {
    auth: { userDetails },
  } = useAppSelector((s: any) => s);
  const prefs = userDetails?.notificationPreferences;
  const [emailNotifications, setEmailNotifications] = useState(prefs?.email ?? true);
  const [pushNotifications, setPushNotifications] = useState(prefs?.push ?? true);
  const [marketingEmails, setMarketingEmails] = useState(prefs?.marketing ?? false);
  const [timeZone, setTimeZone] = useState(
    () => userDetails?.timeZone || detectUserTimeZone(),
  );
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (userDetails?.timeZone) {
      setTimeZone(userDetails.timeZone);
    }
  }, [userDetails?.timeZone]);

  useEffect(() => {
    if (!prefs) return;
    if (typeof prefs.email === 'boolean') setEmailNotifications(prefs.email);
    if (typeof prefs.push === 'boolean') setPushNotifications(prefs.push);
    if (typeof prefs.marketing === 'boolean') setMarketingEmails(prefs.marketing);
  }, [prefs]);

  const cardClass =
    'rounded-2xl border border-wl-line bg-wl-card p-5 shadow-[0_10px_30px_rgba(35,76,106,0.08)]';

  const toggleClass = (enabled: boolean) =>
    `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      enabled ? 'bg-wl-brand' : 'bg-slate-300'
    }`;

  const handleSave = async () => {
    setSaveError('');
    const ok = await doUpdateProfile({
      timeZone,
      notificationPreferences: {
        email: emailNotifications,
        push: pushNotifications,
        marketing: marketingEmails,
      },
    });
    if (ok) {
      setSaveMessage('Settings saved successfully.');
      window.setTimeout(() => setSaveMessage(''), 2200);
    } else {
      setSaveError('Could not save settings. Please try again.');
    }
  };

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto bg-wl-page px-6 py-7">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-wl-ink">Admin settings</h1>
        <p className="mt-1 text-sm text-wl-muted">
          Time zone, notification preferences, and account security.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cardClass}>
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-wl-brand" aria-hidden />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-wl-ink">
              Notifications
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                label: 'Email notifications',
                hint: 'Get updates for reviews, contacts, and platform alerts by email.',
                enabled: emailNotifications,
                setEnabled: setEmailNotifications,
                icon: <Mail className="h-4 w-4 text-wl-muted" aria-hidden />,
              },
              {
                label: 'Push notifications',
                hint: 'Receive in-app reminders and quick alerts.',
                enabled: pushNotifications,
                setEnabled: setPushNotifications,
                icon: <Smartphone className="h-4 w-4 text-wl-muted" aria-hidden />,
              },
              {
                label: 'Product & newsletter emails',
                hint: 'Receive product updates and feature announcements.',
                enabled: marketingEmails,
                setEnabled: setMarketingEmails,
                icon: <Mail className="h-4 w-4 text-wl-muted" aria-hidden />,
              },
            ].map(item => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-3 rounded-xl border border-wl-line bg-wl-pageAlt px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-wl-ink">
                    {item.icon}
                    <span>{item.label}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-wl-muted">{item.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => item.setEnabled((v: boolean) => !v)}
                  className={toggleClass(item.enabled)}
                  aria-pressed={item.enabled}
                  aria-label={item.label}
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
            <Globe2 className="h-4 w-4 text-wl-brand" aria-hidden />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-wl-ink">
              Regional & security
            </h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-wl-line bg-wl-pageAlt px-3 py-3">
              <label htmlFor="admin-timezone" className="mb-1 block text-xs font-semibold text-wl-ink">
                Time zone
              </label>
              <select
                id="admin-timezone"
                aria-label="Time zone"
                value={timeZone}
                onChange={e => setTimeZone(e.target.value)}
                className="w-full rounded-lg border border-wl-line bg-white px-3 py-2 text-sm text-wl-ink outline-none focus:ring-2 focus:ring-wl-brand/20"
              >
                {TIME_ZONES.map(tz => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-wl-muted">
                Event times in the admin portal use this zone.
              </p>
            </div>

            <div className="rounded-xl border border-wl-line bg-white px-3 py-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-wl-ink">
                <Shield className="h-4 w-4 text-wl-muted" aria-hidden />
                <span>Password</span>
              </p>
              <p className="mt-1 text-xs text-wl-muted">
                Use the forgot-password flow on the login page for OTP-based password changes.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-xl bg-wl-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          Save settings
        </button>
        {saveError ? <p className="text-sm font-semibold text-red-600">{saveError}</p> : null}
        {saveMessage ? (
          <p className="text-sm font-semibold text-emerald-700">{saveMessage}</p>
        ) : null}
      </div>
    </div>
  );
}

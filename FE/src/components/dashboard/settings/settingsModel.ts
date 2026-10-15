export type EmailOptionKey = 'bookings' | 'seminars' | 'sessions' | 'product';

export type SettingsState = {
  emailEnabled: boolean;
  email: Record<EmailOptionKey, boolean>;
  timeZone: string;
};

export type EmailOption = {
  key: EmailOptionKey;
  label: string;
  description: string;
  comingSoon?: boolean;
};

export const EMAIL_OPTIONS: EmailOption[] = [
  {
    key: 'bookings',
    label: 'Bookings and approvals',
    description: 'When a mentor accepts, declines, or reschedules.',
  },
  {
    key: 'seminars',
    label: 'Seminar reminders',
    description: "Before seminars you've registered for.",
  },
  {
    key: 'sessions',
    label: '1:1 session reminders',
    description: 'Before your booked mentorship sessions.',
  },
  {
    key: 'product',
    label: 'Product updates',
    description: 'New features and occasional newsletters.',
    comingSoon: true,
  },
];

/** Backend `notificationPreferences` field for each option; `email` is the master switch. */
const PREFERENCE_FIELD: Record<EmailOptionKey, string> = {
  bookings: 'bookings',
  seminars: 'seminarReminders',
  sessions: 'sessionReminders',
  product: 'marketing',
};

const OPTION_DEFAULTS: Record<EmailOptionKey, boolean> = {
  bookings: true,
  seminars: true,
  sessions: true,
  product: false,
};

const pickBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

export function settingsFromUser(
  userDetails: { timeZone?: string; notificationPreferences?: Record<string, unknown> } | undefined,
  fallbackTimeZone: string,
): SettingsState {
  const prefs = userDetails?.notificationPreferences ?? {};
  const email = {} as Record<EmailOptionKey, boolean>;
  for (const { key } of EMAIL_OPTIONS) {
    email[key] = pickBoolean(prefs[PREFERENCE_FIELD[key]], OPTION_DEFAULTS[key]);
  }
  return {
    emailEnabled: pickBoolean(prefs.email, true),
    email,
    timeZone: userDetails?.timeZone || fallbackTimeZone,
  };
}

export function toProfileUpdate(settings: SettingsState) {
  const notificationPreferences: Record<string, boolean> = { email: settings.emailEnabled };
  for (const { key } of EMAIL_OPTIONS) {
    notificationPreferences[PREFERENCE_FIELD[key]] = settings.email[key];
  }
  return { timeZone: settings.timeZone, notificationPreferences };
}

export function emailSummary(settings: SettingsState): string {
  if (!settings.emailEnabled) return 'All emails off';
  const available = EMAIL_OPTIONS.filter(option => !option.comingSoon);
  const on = available.filter(({ key }) => settings.email[key]).length;
  return `${on} of ${available.length} email types on`;
}

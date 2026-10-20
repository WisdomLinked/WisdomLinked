export type EmailPreference = 'bookings' | 'seminarReminders' | 'sessionReminders';

export const NOTIFICATION_PREFERENCE_KEYS = [
    'email',
    'push',
    'bookings',
    'seminarReminders',
    'sessionReminders',
    'marketing',
];

export const wantsEmail = (user: any, preference: EmailPreference): boolean => {
    const prefs = user?.notificationPreferences;
    if (!prefs) return true;
    if (prefs.email === false) return false;
    return prefs[preference] !== false;
};

export const bookingEmailTo = (user: any): string =>
    user?.email && wantsEmail(user, 'bookings') ? String(user.email) : '';

import { useEffect, useMemo, useRef } from 'react';
import { getMe } from '../../api/api';
import { useAppDispatch, useAppSelector } from '../../store';
import { detectUserTimeZone } from '../../utils/schedulingTimezone';
import FormAlert from '../FormAlert';
import { DASHBOARD_PAGE_TITLE } from './pageTitle';
import EmailNotificationsGroup from './settings/EmailNotificationsGroup';
import TimeZoneField from './settings/TimeZoneField';
import { settingsFromUser } from './settings/settingsModel';
import { useAutoSaveSettings } from './settings/useAutoSaveSettings';

export default function StudentSettings() {
  const userDetails = useAppSelector((s: any) => s.auth.userDetails);
  const initial = useMemo(() => settingsFromUser(userDetails, detectUserTimeZone()), [userDetails]);
  const { settings, update, banner, dismissBanner } = useAutoSaveSettings(initial);
  const dispatch = useAppDispatch();
  const userRef = useRef(userDetails);
  userRef.current = userDetails;

  useEffect(() => {
    let running = false;
    const refresh = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      const res: any = await getMe(undefined, { logoutOnAuth: false }).finally(() => {
        running = false;
      });
      const me = res?.me;
      if (!me?.notificationPreferences || !me.timeZone) return;
      const current = userRef.current;
      const unchanged =
        me.timeZone === current?.timeZone &&
        JSON.stringify(me.notificationPreferences) === JSON.stringify(current?.notificationPreferences);
      if (unchanged) return;
      dispatch({
        type: 'updateUserDetails',
        payload: { notificationPreferences: me.notificationPreferences, timeZone: me.timeZone },
      });
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [dispatch]);

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF] px-6 py-7">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 text-center">
          <h1 className={DASHBOARD_PAGE_TITLE}>Settings</h1>
          <p className="mt-1 text-sm text-[#7A7A72]">Choose what you hear about and when.</p>
        </header>

        <section className="rounded-2xl border border-[#E5E2DB] bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
          <EmailNotificationsGroup
            settings={settings}
            onToggleAll={emailEnabled => update(prev => ({ ...prev, emailEnabled }))}
            onToggleOption={(key, enabled) =>
              update(prev => ({ ...prev, email: { ...prev.email, [key]: enabled } }))
            }
          />
          <div className="my-5 border-t border-[#E5E2DB]" />
          <TimeZoneField value={settings.timeZone} onChange={timeZone => update(prev => ({ ...prev, timeZone }))} />
        </section>

        {banner ? (
          <FormAlert
            key={banner.id}
            variant={banner.variant}
            message={banner.message}
            onDismiss={dismissBanner}
            className="mt-4"
          />
        ) : null}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { doUpdateProfile } from '../../../api/api';
import { toProfileUpdate, type SettingsState } from './settingsModel';

export const SAVE_DEBOUNCE_MS = 400;
export const BANNER_DISMISS_MS = 3000;

export type SaveBanner = { id: number; variant: 'success' | 'error'; message: string };

/**
 * Saves are serialized: at most one request is in flight, and it always carries the
 * latest state, so a slow response can never overwrite a newer change.
 */
export function useAutoSaveSettings(initial: SettingsState) {
  const [settings, setSettings] = useState(initial);
  const [banner, setBanner] = useState<SaveBanner | null>(null);

  const latestRef = useRef(initial);
  const savedRef = useRef(initial);
  const touchedRef = useRef(false);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Server values only apply until the first edit; after that local state is the source of truth.
  const initialKey = JSON.stringify(initial);
  useEffect(() => {
    if (touchedRef.current) return;
    latestRef.current = initial;
    savedRef.current = initial;
    setSettings(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const showBanner = useCallback((variant: SaveBanner['variant'], message: string) => {
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    setBanner({ id: Date.now(), variant, message });
    bannerTimerRef.current = window.setTimeout(() => setBanner(null), BANNER_DISMISS_MS);
  }, []);

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    setBanner(null);
  }, []);

  const flush = useCallback(async () => {
    saveTimerRef.current = null;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    inFlightRef.current = true;
    const snapshot = latestRef.current;
    const ok = (await doUpdateProfile(toProfileUpdate(snapshot))) === true;
    inFlightRef.current = false;
    if (!mountedRef.current) return;

    if (!ok) {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      queuedRef.current = false;
      latestRef.current = savedRef.current;
      setSettings(savedRef.current);
      showBanner('error', "Couldn't save your settings. Try again.");
      return;
    }

    savedRef.current = snapshot;
    if (queuedRef.current) {
      queuedRef.current = false;
      void flush();
    } else if (!saveTimerRef.current) {
      showBanner('success', 'Settings saved');
    }
  }, [showBanner]);

  const update = useCallback(
    (change: (prev: SettingsState) => SettingsState) => {
      const next = change(latestRef.current);
      touchedRef.current = true;
      latestRef.current = next;
      setSettings(next);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        void doUpdateProfile(toProfileUpdate(latestRef.current));
      }
    };
  }, []);

  return { settings, update, banner, dismissBanner };
}

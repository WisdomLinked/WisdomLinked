import { useCallback, useEffect, useRef, useState } from 'react';
import { doUpdateProfile } from '../../../api/api';
import { changedProfileUpdate, sameSettings, type SettingsState } from './settingsModel';

export const SAVE_DEBOUNCE_MS = 400;
export const BANNER_DISMISS_MS = 3000;

export type SaveBanner = { id: number; variant: 'success' | 'error'; message: string };

/**
 * Saves are serialized: at most one request is in flight, and each one sends only
 * what changed since the last successful save, so a slow response, or another tab
 * showing older values, can never overwrite a newer change.
 */
export function useAutoSaveSettings(initial: SettingsState) {
  const [settings, setSettings] = useState(initial);
  const [banner, setBanner] = useState<SaveBanner | null>(null);

  const latestRef = useRef(initial);
  const savedRef = useRef(initial);
  const serverRef = useRef(initial);
  const adoptPendingRef = useRef(false);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const isIdle = () =>
    !saveTimerRef.current &&
    !inFlightRef.current &&
    !queuedRef.current &&
    sameSettings(latestRef.current, savedRef.current);

  const adoptServerValues = useCallback(() => {
    adoptPendingRef.current = false;
    const server = serverRef.current;
    if (sameSettings(server, latestRef.current) && sameSettings(server, savedRef.current)) return;
    latestRef.current = server;
    savedRef.current = server;
    if (mountedRef.current) setSettings(server);
  }, []);

  const initialKey = JSON.stringify(initial);
  useEffect(() => {
    serverRef.current = initial;
    if (isIdle()) adoptServerValues();
    else adoptPendingRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const showBanner = useCallback((variant: SaveBanner['variant'], message: string) => {
    if (!mountedRef.current) return;
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    setBanner({ id: Date.now(), variant, message });
    bannerTimerRef.current = window.setTimeout(() => setBanner(null), BANNER_DISMISS_MS);
  }, []);

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    setBanner(null);
  }, []);

  // Keeps running after the page is left, so a change made just before leaving is still saved.
  const flush = useCallback(async () => {
    saveTimerRef.current = null;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    const snapshot = latestRef.current;
    const update = changedProfileUpdate(savedRef.current, snapshot);
    if (!update) {
      if (adoptPendingRef.current && isIdle()) adoptServerValues();
      showBanner('success', 'Settings saved');
      return;
    }
    inFlightRef.current = true;
    const ok = (await doUpdateProfile(update)) === true;
    inFlightRef.current = false;

    if (!ok) {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      queuedRef.current = false;
      latestRef.current = savedRef.current;
      if (mountedRef.current) setSettings(savedRef.current);
      showBanner('error', "Couldn't save your settings. Try again.");
      return;
    }

    savedRef.current = snapshot;
    if (queuedRef.current) {
      queuedRef.current = false;
      void flush();
    } else if (!saveTimerRef.current) {
      if (adoptPendingRef.current && isIdle()) adoptServerValues();
      showBanner('success', 'Settings saved');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBanner, adoptServerValues]);

  const update = useCallback(
    (change: (prev: SettingsState) => SettingsState) => {
      const next = change(latestRef.current);
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
        void flush();
      }
    };
  }, [flush]);

  return { settings, update, banner, dismissBanner };
}

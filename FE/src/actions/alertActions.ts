import { actionTypes } from './types';
import type { AlertVariant, EnqueueToastPayload, NotifyOptions } from '../types/alert';
import { DEFAULT_ALERT_VARIANT } from '../types/alert';

export const enqueueToast = (payload: EnqueueToastPayload) => ({
    type: actionTypes.showAlert,
    payload,
});

export const dismissToast = (id?: string) => ({
    type: actionTypes.hideAlert,
    payload: id ? { id } : undefined,
});

/** @deprecated Prefer notify.* at call sites. Kept for tests and the notify wrapper. */
export const showAlert = (
    title: string,
    variant: AlertVariant = DEFAULT_ALERT_VARIANT,
    opts?: NotifyOptions,
) => enqueueToast({ title, variant, ...opts });

export const showErrorAlert = (title: string, opts?: NotifyOptions) => showAlert(title, 'error', opts);

export const showSuccessAlert = (title: string, opts?: NotifyOptions) => showAlert(title, 'success', opts);

export const showWarningAlert = (title: string, opts?: NotifyOptions) => showAlert(title, 'warning', opts);

export const showInfoAlert = (title: string, opts?: NotifyOptions) => showAlert(title, 'info', opts);

export const hideAlert = () => dismissToast();

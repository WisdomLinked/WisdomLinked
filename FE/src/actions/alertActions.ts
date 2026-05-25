import { actionTypes } from './types';
import type { AlertVariant } from '../types/alert';
import { DEFAULT_ALERT_VARIANT } from '../types/alert';

export type ShowAlertPayload = {
    message: string;
    variant?: AlertVariant;
};

export const showAlert = (
    message: string,
    variant: AlertVariant = DEFAULT_ALERT_VARIANT,
) => ({
    type: actionTypes.showAlert,
    payload: { message, variant },
});

export const showErrorAlert = (message: string) => showAlert(message, 'error');

export const showSuccessAlert = (message: string) => showAlert(message, 'success');

export const showWarningAlert = (message: string) => showAlert(message, 'warning');

export const hideAlert = () => ({
    type: actionTypes.hideAlert,
});

import { AlertActions, actionTypes } from '../actions/types';
import type { AlertVariant, ToastItem } from '../types/alert';
import {
    DEFAULT_ALERT_VARIANT,
    MAX_VISIBLE_TOASTS,
    TOAST_DURATION_MS,
    toastDedupeKey,
} from '../types/alert';

export interface AlertState {
    toasts: ToastItem[];
}

const initialState: AlertState = {
    toasts: [],
};

let toastSeq = 0;

function nextToastId(): string {
    toastSeq += 1;
    return `toast-${Date.now()}-${toastSeq}`;
}

export const alertReducer = (state = initialState, action: AlertActions): AlertState => {
    switch (action.type) {
        case actionTypes.showAlert: {
            const payload = action.payload;
            const variant: AlertVariant = payload.variant ?? DEFAULT_ALERT_VARIANT;
            const title = payload.title;
            if (!title) return state;

            const durationMs = payload.persistent
                ? 0
                : payload.duration ?? TOAST_DURATION_MS[variant];
            const incoming: ToastItem = {
                id: nextToastId(),
                variant,
                title,
                description: payload.description,
                createdAt: Date.now(),
                durationMs,
                persistent: Boolean(payload.persistent),
                action: payload.action,
            };

            const key = toastDedupeKey(incoming);
            const existingIndex = state.toasts.findIndex(t => toastDedupeKey(t) === key);
            if (existingIndex >= 0) {
                const bumped: ToastItem = {
                    ...state.toasts[existingIndex],
                    createdAt: incoming.createdAt,
                    durationMs: incoming.durationMs,
                    persistent: incoming.persistent,
                    action: incoming.action ?? state.toasts[existingIndex].action,
                    description: incoming.description,
                };
                const rest = state.toasts.filter((_, i) => i !== existingIndex);
                return { toasts: [bumped, ...rest] };
            }

            return { toasts: [incoming, ...state.toasts].slice(0, MAX_VISIBLE_TOASTS) };
        }

        case actionTypes.hideAlert: {
            const id = action.payload?.id;
            if (!id) return { toasts: [] };
            return { toasts: state.toasts.filter(t => t.id !== id) };
        }

        default:
            return state;
    }
};

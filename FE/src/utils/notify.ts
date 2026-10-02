import { store } from '../store';
import { dismissToast, enqueueToast } from '../actions/alertActions';
import type { AlertVariant, NotifyOptions } from '../types/alert';

function show(variant: AlertVariant, title: string, opts?: NotifyOptions) {
    store.dispatch(enqueueToast({ variant, title, ...opts }));
}

export const notify = {
    success: (title: string, opts?: NotifyOptions) => show('success', title, opts),
    error: (title: string, opts?: NotifyOptions) => show('error', title, opts),
    warning: (title: string, opts?: NotifyOptions) => show('warning', title, opts),
    info: (title: string, opts?: NotifyOptions) => show('info', title, opts),
    dismiss: (id?: string) => {
        store.dispatch(dismissToast(id));
    },
};

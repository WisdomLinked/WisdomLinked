export type AlertVariant = 'error' | 'success' | 'warning' | 'info';

export const DEFAULT_ALERT_VARIANT: AlertVariant = 'info';

export const TOAST_DURATION_MS: Record<AlertVariant, number> = {
    success: 6500,
    info: 6500,
    warning: 8500,
    error: 11000,
};

/** Live height of announcement + navbar chrome, set by useSyncHeaderHeight. */
export const HEADER_HEIGHT_VAR = '--header-height';
export const TOAST_GAP_BELOW_HEADER_PX = 16;
export const TOAST_RIGHT_OFFSET_PX = 24;
export const TOAST_MOBILE_GUTTER_PX = 16;
export const TOAST_WIDTH_PX = 400;

export const MAX_VISIBLE_TOASTS = 3;

export type ToastAction = {
    label: string;
    onClick: () => void;
};

export type NotifyOptions = {
    description?: string;
    duration?: number;
    persistent?: boolean;
    action?: ToastAction;
};

export type EnqueueToastPayload = {
    variant: AlertVariant;
    title: string;
} & NotifyOptions;

export type ToastItem = {
    id: string;
    variant: AlertVariant;
    title: string;
    description?: string;
    createdAt: number;
    durationMs: number;
    persistent: boolean;
    action?: ToastAction;
};

export function toastDedupeKey(item: Pick<ToastItem, 'variant' | 'title' | 'description'>): string {
    return `${item.variant}|${item.title}|${item.description ?? ''}`;
}

import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { hideAlert } from '../actions/alertActions';
import { useAppSelector } from '../store';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { AlertVariant } from '../types/alert';

const AUTO_HIDE_MS: Record<AlertVariant, number> = {
    error: 7000,
    warning: 6000,
    success: 5000,
    info: 5000,
};

const VARIANT_STYLES: Record<
    AlertVariant,
    { container: string; iconWrap: string; icon: string; Icon: typeof AlertCircle }
> = {
    error: {
        container: 'border-red-200 bg-red-50 shadow-red-900/5',
        iconWrap: 'bg-red-100',
        icon: 'text-red-600',
        Icon: AlertCircle,
    },
    success: {
        container: 'border-emerald-200 bg-emerald-50 shadow-emerald-900/5',
        iconWrap: 'bg-emerald-100',
        icon: 'text-emerald-700',
        Icon: CheckCircle2,
    },
    warning: {
        container: 'border-amber-200 bg-amber-50 shadow-amber-900/5',
        iconWrap: 'bg-amber-100',
        icon: 'text-amber-700',
        Icon: AlertTriangle,
    },
    info: {
        container: 'border-slate-200 bg-white shadow-black/10',
        iconWrap: 'bg-[#e8f0f8]',
        icon: 'text-[#234C6A]',
        Icon: Info,
    },
};

const AlertNotification: React.FC = () => {
    const dispatch = useDispatch();
    const { open, message, variant } = useAppSelector((state) => state.alert);

    const handleClose = () => {
        dispatch(hideAlert());
    };

    useEffect(() => {
        if (!open) return;
        const ms = AUTO_HIDE_MS[variant] ?? 5000;
        const t = window.setTimeout(handleClose, ms);
        return () => window.clearTimeout(t);
    }, [open, message, variant]);

    if (!open || !message) return null;

    const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.info;
    const { Icon } = styles;
    const isAssertive = variant === 'error' || variant === 'warning';

    return (
        <div
            className="pointer-events-none fixed inset-x-0 top-0 z-[10000001] flex justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:inset-x-auto sm:left-auto sm:right-0"
            aria-live={isAssertive ? 'assertive' : 'polite'}
        >
            <div
                role="alert"
                className={`pointer-events-auto flex w-full max-w-[380px] animate-[wlToastIn_0.28s_ease-out] items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg ${styles.container}`}
            >
                <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${styles.iconWrap}`}
                >
                    <Icon className={`h-4 w-4 ${styles.icon}`} aria-hidden />
                </div>
                <div className="min-w-0 flex-1 self-center">
                    <p className="break-words text-[13px] font-medium leading-5 text-gray-900">
                        {message}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleClose}
                    className="ml-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-black/5 hover:text-gray-600"
                    aria-label="Close notification"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            <style>{`
        @keyframes wlToastIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
        </div>
    );
};

export default AlertNotification;

import React, { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { dismissToast } from '../actions/alertActions';
import { useAppSelector } from '../store';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
    HEADER_HEIGHT_VAR,
    TOAST_GAP_BELOW_HEADER_PX,
    TOAST_MOBILE_GUTTER_PX,
    TOAST_RIGHT_OFFSET_PX,
    TOAST_WIDTH_PX,
    type AlertVariant,
    type ToastItem,
} from '../types/alert';

const VARIANT_UI: Record<
    AlertVariant,
    {
        accent: string;
        iconWrap: string;
        icon: string;
        progress: string;
        Icon: typeof CheckCircle2;
        assertive: boolean;
    }
> = {
    success: {
        accent: 'bg-emerald-600',
        iconWrap: 'bg-emerald-50',
        icon: 'text-emerald-600',
        progress: 'bg-emerald-600',
        Icon: CheckCircle2,
        assertive: false,
    },
    error: {
        accent: 'bg-red-600',
        iconWrap: 'bg-red-50',
        icon: 'text-red-600',
        progress: 'bg-red-600',
        Icon: XCircle,
        assertive: true,
    },
    warning: {
        accent: 'bg-amber-600',
        iconWrap: 'bg-amber-50',
        icon: 'text-amber-600',
        progress: 'bg-amber-600',
        Icon: AlertTriangle,
        assertive: true,
    },
    info: {
        accent: 'bg-blue-600',
        iconWrap: 'bg-blue-50',
        icon: 'text-blue-600',
        progress: 'bg-blue-600',
        Icon: Info,
        assertive: false,
    },
};

function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

function ToastCard({ toast }: { toast: ToastItem }) {
    const dispatch = useDispatch();
    const ui = VARIANT_UI[toast.variant] ?? VARIANT_UI.info;
    const { Icon } = ui;
    const reduceMotion = prefersReducedMotion();
    const [exiting, setExiting] = useState(false);
    const [remainingMs, setRemainingMs] = useState(toast.durationMs);
    const pausedRef = useRef(false);
    const remainingRef = useRef(toast.durationMs);
    const lastTickRef = useRef(performance.now());
    const closeTimerRef = useRef<number | null>(null);
    const closingRef = useRef(false);

    const close = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        setExiting(true);
        closeTimerRef.current = window.setTimeout(
            () => dispatch(dismissToast(toast.id)),
            reduceMotion ? 0 : 200,
        );
    };

    useEffect(() => {
        remainingRef.current = toast.durationMs;
        setRemainingMs(toast.durationMs);
        lastTickRef.current = performance.now();
    }, [toast.id, toast.createdAt, toast.durationMs]);

    useEffect(() => {
        if (toast.persistent || toast.durationMs <= 0) return;
        let frame = 0;
        const tick = (now: number) => {
            const elapsed = now - lastTickRef.current;
            lastTickRef.current = now;
            if (!pausedRef.current) {
                remainingRef.current = Math.max(0, remainingRef.current - elapsed);
                setRemainingMs(remainingRef.current);
                if (remainingRef.current <= 0) {
                    close();
                    return;
                }
            }
            frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frame);
        // close is stable enough per toast instance
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast.id, toast.createdAt, toast.durationMs, toast.persistent]);

    useEffect(() => {
        return () => {
            if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
        };
    }, []);

    const pause = () => {
        pausedRef.current = true;
    };
    const resume = () => {
        pausedRef.current = false;
        lastTickRef.current = performance.now();
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            close();
        }
    };

    const progress = toast.persistent || toast.durationMs <= 0
        ? 0
        : Math.max(0, Math.min(100, (remainingMs / toast.durationMs) * 100));

    return (
        <div
            role={ui.assertive ? 'alert' : 'status'}
            aria-live={ui.assertive ? 'assertive' : 'polite'}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onMouseEnter={pause}
            onMouseLeave={resume}
            onFocus={pause}
            onBlur={resume}
            className={`pointer-events-auto relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                reduceMotion ? 'wl-toast-reduce' : exiting ? 'wl-toast-out' : 'wl-toast-in'
            }`}
        >
            <div className={`absolute inset-y-0 left-0 w-1 ${ui.accent}`} aria-hidden />
            <div className="flex items-start gap-3 py-3 pl-4 pr-2">
                <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ui.iconWrap}`}
                >
                    <Icon className={`h-4 w-4 ${ui.icon}`} aria-hidden />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
                    {toast.description ? (
                        <p className="mt-0.5 text-sm text-slate-600">{toast.description}</p>
                    ) : null}
                </div>
                {toast.action ? (
                    <button
                        type="button"
                        onClick={() => {
                            toast.action?.onClick();
                            close();
                        }}
                        className="shrink-0 self-center rounded-md px-2 py-1 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                        {toast.action.label}
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={close}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    aria-label="Close notification"
                >
                    <X className="h-4 w-4" aria-hidden />
                </button>
            </div>
            {!toast.persistent && toast.durationMs > 0 ? (
                <div className="h-0.5 w-full bg-slate-100" aria-hidden>
                    <div
                        className={`h-full ${ui.progress}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            ) : null}
        </div>
    );
}

const AlertNotification: React.FC = () => {
    const toasts = useAppSelector(state => state.alert.toasts);

    if (!toasts.length) return null;

    return (
        <div
            className="wl-toast-stack pointer-events-none fixed z-[10000001] flex flex-col gap-2.5"
            style={{
                top: `calc(var(${HEADER_HEIGHT_VAR}, 4.5rem) + ${TOAST_GAP_BELOW_HEADER_PX}px)`,
            }}
        >
            {toasts.map(toast => (
                <ToastCard key={`${toast.id}-${toast.createdAt}`} toast={toast} />
            ))}
            <style>{`
        .wl-toast-stack {
          right: ${TOAST_MOBILE_GUTTER_PX}px;
          width: min(${TOAST_WIDTH_PX}px, calc(100% - ${TOAST_MOBILE_GUTTER_PX * 2}px));
        }
        @media (min-width: 640px) {
          .wl-toast-stack {
            right: ${TOAST_RIGHT_OFFSET_PX}px;
            width: ${TOAST_WIDTH_PX}px;
          }
        }
        @keyframes wlToastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wlToastOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-8px); }
        }
        .wl-toast-in { animation: wlToastIn 200ms ease-out both; }
        .wl-toast-out { animation: wlToastOut 200ms ease-in both; }
        @media (prefers-reduced-motion: reduce) {
          .wl-toast-in, .wl-toast-out, .wl-toast-reduce { animation: none !important; }
        }
        .wl-toast-reduce { animation: none !important; }
      `}</style>
        </div>
    );
};

export default AlertNotification;

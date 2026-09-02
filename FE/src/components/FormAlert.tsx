import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { AlertVariant } from '../types/alert';

const VARIANT_STYLES: Record<
    AlertVariant,
    { box: string; icon: string; Icon: typeof AlertCircle }
> = {
    error: {
        box: 'bg-red-50 border-red-200 text-red-800',
        icon: 'text-red-600',
        Icon: AlertCircle,
    },
    success: {
        box: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        icon: 'text-emerald-700',
        Icon: CheckCircle2,
    },
    warning: {
        box: 'bg-amber-50 border-amber-200 text-amber-800',
        icon: 'text-amber-700',
        Icon: AlertTriangle,
    },
    info: {
        box: 'bg-slate-50 border-slate-200 text-slate-800',
        icon: 'text-[#234C6A]',
        Icon: Info,
    },
};

export type FormAlertProps = {
    variant?: AlertVariant;
    message: string;
    onDismiss?: () => void;
    className?: string;
    role?: 'alert' | 'status';
};

const FormAlert: React.FC<FormAlertProps> = ({
    variant = 'error',
    message,
    onDismiss,
    className = '',
    role,
}) => {
    if (!message.trim()) return null;

    const { box, icon, Icon } = VARIANT_STYLES[variant];
    const liveRole = role ?? (variant === 'error' || variant === 'warning' ? 'alert' : 'status');

    return (
        <div
            role={liveRole}
            aria-live={variant === 'error' ? 'assertive' : 'polite'}
            className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${box} ${className}`.trim()}
        >
            <Icon size={16} className={`mt-0.5 shrink-0 ${icon}`} aria-hidden />
            <span className="min-w-0 flex-1 leading-snug">{message}</span>
            {onDismiss ? (
                <button
                    type="button"
                    onClick={onDismiss}
                    className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100"
                    aria-label="Dismiss"
                >
                    <X size={14} />
                </button>
            ) : null}
        </div>
    );
};

export default FormAlert;

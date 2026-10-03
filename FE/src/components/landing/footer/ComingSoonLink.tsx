import { useId } from 'react';

interface Props {
    label: string;
    message?: string;
}

export default function ComingSoonLink({ label, message = 'To be available soon' }: Props) {
    const tooltipId = useId();
    return (
        <span className="group relative inline-flex">
            <a
                role="link"
                tabIndex={0}
                aria-disabled="true"
                aria-describedby={tooltipId}
                onClick={e => e.preventDefault()}
                className="cursor-not-allowed text-sm text-slate-400/60"
            >
                {label}
            </a>
            <span
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-1.5 whitespace-nowrap rounded-md border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
            >
                {message}
            </span>
        </span>
    );
}

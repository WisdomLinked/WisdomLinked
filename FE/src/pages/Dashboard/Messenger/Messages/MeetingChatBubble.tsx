import React from 'react';
import { Video } from 'lucide-react';

export type MeetingChatBubbleProps = {
    isSelf: boolean;
    authorLabel: string;
    guest: boolean;
    msg: string;
    timeLabel: string;
    theme: string;
    testId?: string;
};

function shellClass(isSelf: boolean, theme: string): string {
    if (isSelf) {
        return 'rounded-2xl bg-[#1A3A4A] text-white px-3 py-2 shadow-sm';
    }
    const isLight = theme === 'light';
    return isLight
        ? 'rounded-2xl border border-stone-200 bg-white px-3 py-2 text-wl-ink shadow-sm'
        : 'rounded-2xl border border-gray-200 bg-white px-3 py-2 text-gray-900 shadow-sm';
}

function headerClass(isSelf: boolean, theme: string): string {
    if (isSelf) return 'text-[11px] font-semibold uppercase tracking-wide text-white/90';
    return theme === 'light'
        ? 'text-[11px] font-semibold uppercase tracking-wide text-[#1A3A4A]'
        : 'text-[11px] font-semibold uppercase tracking-wide text-[#1A3A4A]';
}

function timeClass(isSelf: boolean, theme: string): string {
    const base = 'text-xs mt-1';
    if (isSelf) return `${base} text-gray-400 text-right`;
    return theme === 'light' ? `${base} text-stone-400 text-left` : `${base} text-gray-400 text-left`;
}

const MeetingChatBubble: React.FC<MeetingChatBubbleProps> = ({
    isSelf,
    authorLabel,
    guest,
    msg,
    timeLabel,
    theme,
    testId,
}) => {
    const guestSuffix = guest ? ' · Guest' : '';
    const headerText = `Meet${guestSuffix} · ${authorLabel}`;
    const iconCls = isSelf ? 'text-white/90' : 'text-[#1A3A4A]';

    return (
        <div
            data-testid={testId}
            className={`flex w-full ${isSelf ? 'justify-end' : 'justify-start'}`}
        >
            <div className="flex max-w-[85%] min-w-0 flex-col gap-0.5">
                <div className={`flex min-w-0 gap-2 ${shellClass(isSelf, theme)}`}>
                    <Video className={`mt-0.5 h-4 w-4 shrink-0 ${iconCls}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                        <p className={headerClass(isSelf, theme)}>{headerText}</p>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-snug">{msg}</p>
                    </div>
                </div>
                <p className={timeClass(isSelf, theme)}>{timeLabel}</p>
            </div>
        </div>
    );
};

export default MeetingChatBubble;

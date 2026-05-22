import React from 'react';
import { Video } from 'lucide-react';
import MeetingChatBubble from './MeetingChatBubble';

export type MeetingChatPanelLine = {
    messageId: string;
    isSelf: boolean;
    authorLabel: string;
    guest: boolean;
    msg: string;
    timeLabel: string;
};

export type MeetingChatPanelProps = {
    lines: MeetingChatPanelLine[];
    theme: string;
};

const MeetingChatPanel: React.FC<MeetingChatPanelProps> = ({ lines, theme }) => {
    const isLight = theme === 'light';
    const frameCls = isLight
        ? 'border border-stone-200 bg-stone-50/90 shadow-sm'
        : 'border border-gray-600 bg-darkgrey-2/90 shadow-sm';
    const headerCls = isLight ? 'text-stone-500' : 'text-gray-400';

    return (
        <div
            data-testid="meeting-chat-panel"
            className={`mx-auto w-[70%] max-w-2xl rounded-xl px-3 py-2.5 ${frameCls}`}
        >
            <div className={`mb-2 flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-wide ${headerCls}`}>
                <Video className="h-3.5 w-3.5 shrink-0 text-[#1A3A4A]" aria-hidden />
                <span>In-meeting chat</span>
            </div>
            <div className="flex flex-col gap-0.5">
                {lines.map((line, idx) => {
                    const prev = lines[idx - 1];
                    const next = lines[idx + 1];
                    const tightTop = prev && prev.isSelf === line.isSelf;
                    const tightBottom = next && next.isSelf === line.isSelf;
                    const rowMb = tightBottom ? 'mb-0.5' : 'mb-1.5';
                    const rowMt = tightTop ? '' : 'mt-0.5';
                    return (
                        <div key={line.messageId} className={`${rowMt} ${rowMb}`.trim()}>
                            <MeetingChatBubble
                                isSelf={line.isSelf}
                                authorLabel={line.authorLabel}
                                guest={line.guest}
                                msg={line.msg}
                                timeLabel={line.timeLabel}
                                theme={theme}
                                testId={line.isSelf ? 'meeting-chat-out' : 'meeting-chat-in'}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MeetingChatPanel;

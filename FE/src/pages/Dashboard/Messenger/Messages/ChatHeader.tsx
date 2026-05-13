import React from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Video, Phone, MoreHorizontal } from 'lucide-react';

export interface ChatHeaderProps {
    name: string;
    status: 'online' | 'offline' | 'away';
    lastSeen?: Date;
    avatarInitials: string;
    avatarColor?: string;
}

type ChatHeaderInnerProps = ChatHeaderProps & {
    theme?: 'light' | 'dark';
    className?: string;
    onNameAreaClick?: () => void;
    onVideoClick?: () => void;
    videoDisabled?: boolean;
    videoTitle?: string;
    onPhoneClick?: () => void;
    phoneDisabled?: boolean;
    onMoreClick?: () => void;
};

export function getStatusLabel(status: 'online' | 'offline' | 'away', lastSeen?: Date): string {
    if (status === 'online') {
        return 'Online';
    }
    if (status === 'away') {
        return 'Away';
    }
    if (lastSeen != null && !Number.isNaN(lastSeen.getTime())) {
        const clock = format(lastSeen, 'h:mm a');
        if (isToday(lastSeen)) {
            return `Offline - last seen today at ${clock}`;
        }
        if (isYesterday(lastSeen)) {
            return `Offline - last seen yesterday at ${clock}`;
        }
        return `Offline - last seen ${format(lastSeen, 'MMMM d')} at ${clock}`;
    }
    return 'Offline';
}

const ChatHeader: React.FC<ChatHeaderInnerProps> = ({
    name,
    status,
    lastSeen,
    avatarInitials,
    avatarColor,
    theme = 'light',
    className = '',
    onNameAreaClick,
    onVideoClick,
    videoDisabled,
    videoTitle,
    onPhoneClick,
    phoneDisabled,
    onMoreClick,
}) => {
    const statusText = getStatusLabel(status, lastSeen);
    const isLight = theme === 'light';
    const barClass = isLight ? 'bg-white' : 'bg-[#141414]';

    const nameHeadingClass = isLight
        ? 'text-[15px] font-semibold text-[#1A3A4A] leading-tight'
        : 'text-[15px] font-semibold text-white leading-tight';

    const actionIconBtnClass = isLight
        ? 'w-9 h-9 flex items-center justify-center rounded-lg text-slate-700 hover:text-[#1A3A4A] hover:bg-[#F5F3EF] transition-colors duration-150'
        : 'w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors duration-150';

    return (
        <div
            className={`flex w-full min-w-0 items-center justify-between -mx-5 px-5 ${barClass} ${className}`.trim()}
        >
            <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A3A4A]/20"
                onClick={onNameAreaClick}
            >
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8EEF4] text-xs font-semibold text-[#1A3A4A]"
                    style={avatarColor ? { backgroundColor: avatarColor } : undefined}
                    aria-hidden
                >
                    {avatarInitials}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0 leading-tight">
                    <h2 className={`truncate ${nameHeadingClass}`}>{name}</h2>
                    <p className="text-xs text-gray-400 font-normal">{statusText}</p>
                </div>
            </button>
            <div className="flex shrink-0 items-center gap-1">
                <button
                    type="button"
                    aria-label="Start video call"
                    title={videoTitle}
                    disabled={videoDisabled}
                    onClick={onVideoClick}
                    className={`${actionIconBtnClass} disabled:pointer-events-none disabled:opacity-50`}
                >
                    <Video size={18} />
                </button>
                <button
                    type="button"
                    aria-label="Start voice call"
                    title={videoTitle}
                    disabled={phoneDisabled}
                    onClick={onPhoneClick}
                    className={`${actionIconBtnClass} disabled:pointer-events-none disabled:opacity-50`}
                >
                    <Phone size={18} />
                </button>
                <button
                    type="button"
                    aria-label="More options"
                    onClick={onMoreClick}
                    className={actionIconBtnClass}
                >
                    <MoreHorizontal size={18} />
                </button>
            </div>
        </div>
    );
};

export default ChatHeader;

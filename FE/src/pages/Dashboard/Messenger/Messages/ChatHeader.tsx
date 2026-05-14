import React from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Video, MoreHorizontal } from 'lucide-react';

export interface ChatHeaderProps {
    name: string;
    status: 'online' | 'offline' | 'away';
    lastSeen?: Date;
    avatarInitials: string;
    avatarColor?: string;
    /** DM peer photo URL — same field as `chosenChatDetails.image` in chat state. */
    image?: string;
    profilePhoto?: string;
    avatar?: string;
    photoURL?: string;
}

type ChatHeaderInnerProps = ChatHeaderProps & {
    theme?: 'light' | 'dark';
    className?: string;
    onNameAreaClick?: () => void;
    onVideoClick?: () => void;
    videoDisabled?: boolean;
    videoTitle?: string;
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
    image,
    profilePhoto,
    avatar,
    photoURL,
    theme = 'light',
    className = '',
    onNameAreaClick,
    onVideoClick,
    videoDisabled,
    videoTitle,
    onMoreClick,
}) => {
    const statusText = getStatusLabel(status, lastSeen);
    const isLight = theme === 'light';
    const photoSrc =
        profilePhoto || avatar || photoURL || image || undefined;
    const barClass = isLight ? 'bg-wl-page' : 'bg-darkgrey-1';

    const nameHeadingClass = isLight
        ? 'text-[15px] font-semibold font-serif text-[#1A3A4A] leading-tight'
        : 'text-[15px] font-semibold text-white leading-tight';

    const actionIconBtnClass = isLight
        ? 'w-9 h-9 flex items-center justify-center rounded-lg text-stone-400 hover:text-teal-700 transition-colors duration-150'
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
                {photoSrc ? (
                    <img
                        src={photoSrc}
                        alt={name}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                ) : (
                    <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white"
                        aria-hidden
                    >
                        {name
                            ?.split(' ')
                            .map(n => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase() || avatarInitials}
                    </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0 leading-tight">
                    <h2 className={`truncate ${nameHeadingClass}`}>{name}</h2>
                    <p
                        className={
                            isLight
                                ? 'text-sm text-stone-400 font-normal'
                                : 'text-xs text-gray-400 font-normal'
                        }
                    >
                        {statusText}
                    </p>
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

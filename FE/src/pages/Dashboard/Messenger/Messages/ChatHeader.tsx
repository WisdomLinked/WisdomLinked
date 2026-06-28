import React from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Video, MoreHorizontal, CalendarPlus } from 'lucide-react';

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
    /** Shown as a hover shortcut over the peer's name to jump to the appointment flow. */
    onNewAppointment?: () => void;
    newAppointmentLabel?: string;
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
    onNewAppointment,
    newAppointmentLabel = 'Make a new appointment',
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
            <div className="group/appt relative flex min-w-0 flex-1 items-center">
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
                {onNewAppointment ? (
                    <div className="pointer-events-none absolute left-12 top-full z-30 pt-1.5 opacity-0 transition-opacity duration-150 group-hover/appt:pointer-events-auto group-hover/appt:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
                        <button
                            type="button"
                            onClick={e => {
                                e.stopPropagation();
                                onNewAppointment();
                            }}
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-lg ${
                                isLight
                                    ? 'border-slate-200 bg-white text-[#234C6A] hover:bg-slate-50'
                                    : 'border-slate-700 bg-[#141414] text-white hover:bg-white/10'
                            }`}
                        >
                            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
                            {newAppointmentLabel}
                        </button>
                    </div>
                ) : null}
            </div>
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

import React, { useState, useEffect } from 'react';
import {
    createMeetingGuestInvite,
    getMeetingJoinInfo,
    getMeetingThread,
    getMeetingRatingState,
    submitMeetingRating,
} from '../api/chatApi';
import { formatMessageTime } from '../utils/formatMessageTime';
import { trackMeetingJoin } from '../utils/meetingSession';

const MEET_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

interface MeetingCardProps {
    meetingThreadId: string;
    jitsiRoomName: string;
    starterName: string;
    /** Prefer meet/call start time for invite expiry; falls back to `startedAt`. */
    createdAt?: string | number | Date;
    startedAt?: string | number | Date;
    isEnded?: boolean;
    duration?: number;
    participantCount?: number;
    theme?: 'dark' | 'light';
    onJoin?: (jitsiUrl: string) => void;
}

interface TranscriptLine {
    authorName?: string;
    author?: { username?: string };
    content?: string;
}

const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
};

const formatStartedAtLocalTime = (value?: string | number | Date): string => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return formatMessageTime(date);
};

const MeetingCard: React.FC<MeetingCardProps> = ({
    meetingThreadId,
    starterName,
    createdAt,
    startedAt,
    isEnded = false,
    duration = 0,
    participantCount = 0,
    theme = 'dark',
    onJoin,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
    const [loading, setLoading] = useState(false);
    const [canRate, setCanRate] = useState(false);
    const [hasRated, setHasRated] = useState(false);
    const [ratingBlockedReason, setRatingBlockedReason] = useState<string>('');
    const [targetName, setTargetName] = useState<string>('');
    const [score, setScore] = useState<number>(5);
    const [comment, setComment] = useState('');
    const [submittingRating, setSubmittingRating] = useState(false);
    const [inviteBusy, setInviteBusy] = useState(false);
    const [joinBusy, setJoinBusy] = useState(false);
    const openMeetingUrl = (jitsiUrl: string, pendingWindow: Window | null = null) => {
        if (pendingWindow && !pendingWindow.closed) {
            pendingWindow.location.href = jitsiUrl;
            return;
        }
        window.location.assign(jitsiUrl);
    };
    const handleJoin = async () => {
        const pendingWindow = window.open('', '_blank');
        setJoinBusy(true);
        const info = await getMeetingJoinInfo(meetingThreadId);
        setJoinBusy(false);
        if (!info?.success || !info?.jitsiUrl) {
            if (pendingWindow && !pendingWindow.closed) {
                pendingWindow.close();
            }
            window.alert(info?.error || 'Could not join call. Please retry from chat.');
            return;
        }
        trackMeetingJoin(info.meetingThreadId ?? meetingThreadId, info.jitsiUrl);
        onJoin?.(info.jitsiUrl);
        openMeetingUrl(info.jitsiUrl, pendingWindow);
    };

    const loadTranscript = async () => {
        if (transcript.length > 0) {
            setExpanded(!expanded);
            return;
        }
        setLoading(true);
        const data = await getMeetingThread(meetingThreadId);
        if (data?.meeting?.transcript && Array.isArray(data.meeting.transcript)) {
            setTranscript(data.meeting.transcript as TranscriptLine[]);
        }
        setExpanded(true);
        setLoading(false);
    };

    const isDark = theme === 'dark';
    const startedAtLocalTime = formatStartedAtLocalTime(startedAt);

    const expiryAnchor = createdAt ?? startedAt;
    const expiryMs =
        expiryAnchor !== undefined && expiryAnchor !== null && expiryAnchor !== ''
            ? new Date(expiryAnchor as string | number | Date).getTime()
            : NaN;
    const isExpired =
        Number.isFinite(expiryMs) && Date.now() - expiryMs > MEET_EXPIRY_MS;

    useEffect(() => {
        let cancelled = false;
        const loadRatingState = async () => {
            if (!isEnded || !meetingThreadId) return;
            const state = await getMeetingRatingState(meetingThreadId);
            if (cancelled) return;
            setCanRate(Boolean(state?.canRate));
            setRatingBlockedReason(String(state?.ratingBlockedReason || ''));
            setHasRated(Boolean(state?.hasRated));
            setTargetName(String(state?.targetUser?.username || ''));
            if (state?.existingRating?.score) setScore(Number(state.existingRating.score));
            if (typeof state?.existingRating?.comment === 'string') {
                setComment(state.existingRating.comment);
            }
        };
        void loadRatingState();
        return () => {
            cancelled = true;
        };
    }, [isEnded, meetingThreadId]);

    const handleRateSubmit = async () => {
        setSubmittingRating(true);
        const res = await submitMeetingRating(meetingThreadId, score, comment);
        setSubmittingRating(false);
        if (res?.success) setHasRated(true);
    };

    const handleCopyGuestInvite = async () => {
        setInviteBusy(true);
        const res = await createMeetingGuestInvite(meetingThreadId, 2);
        setInviteBusy(false);
        if (res?.success && res.inviteUrl) {
            const normalizedInviteUrl = (() => {
                const raw = String(res.inviteUrl || '').trim();
                const tokenMatch = raw.match(/\/meeting\/invite\/([^/?#]+)/);
                if (tokenMatch?.[1]) {
                    return `${window.location.origin}/meeting/invite/${tokenMatch[1]}`;
                }
                if (raw.startsWith('/')) {
                    return `${window.location.origin}${raw}`;
                }
                return raw;
            })();
            try {
                await navigator.clipboard.writeText(normalizedInviteUrl);
                window.alert('Guest invite link copied (valid up to 2 hours).');
            } catch {
                window.alert(normalizedInviteUrl);
            }
        } else {
            window.alert(res?.error || 'Could not create guest invite link');
        }
    };

    const starter = starterName || 'Someone';
    const startedLineParts: string[] = [`Started by ${starter}`];
    if (startedAtLocalTime.length > 0) startedLineParts.push(startedAtLocalTime);
    if (isEnded && duration > 0) startedLineParts.push(formatDuration(duration));
    if (isEnded && participantCount > 0) startedLineParts.push(`${participantCount} participants`);
    const startedLine = startedLineParts.join(' · ');

    const statusBanner = isEnded ? (
        <div
            className={`flex items-center gap-3 rounded-xl border border-l-4 px-4 py-3 my-3 shadow-sm opacity-60 pointer-events-none ${
                theme === 'light'
                    ? 'bg-stone-50 border-stone-200 border-l-stone-400'
                    : 'bg-gray-100 border-gray-200 border-l-gray-400'
            }`}
        >
            <div className="min-w-0">
                <p className={`text-sm font-semibold ${theme === 'light' ? 'text-stone-500' : 'text-gray-500'}`}>
                    WisdomLinked Meet ended
                </p>
                <p className="text-xs text-stone-400 mt-0.5">{startedLine}</p>
            </div>
        </div>
    ) : (
        <div
            className={`flex items-center justify-between gap-3 rounded-xl border border-l-4 border-l-[#1A3A4A] px-4 py-3 my-3 shadow-sm ${
                theme === 'light' ? 'bg-white border-stone-200' : 'bg-white border-gray-200'
            } ${isExpired ? 'opacity-50 pointer-events-none' : ''}`}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1A3A4A]">WisdomLinked Meet in progress</p>
                    <p className="text-xs text-gray-400 mt-0.5">{startedLine}</p>
                    {isExpired ? (
                        <span className="text-xs text-stone-400 mt-0.5 block">Invite expired</span>
                    ) : null}
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    type="button"
                    onClick={() => void handleCopyGuestInvite()}
                    disabled={inviteBusy || isExpired}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border whitespace-nowrap transition-colors disabled:opacity-70 ${
                        isExpired ? 'opacity-50 cursor-not-allowed' : ''
                    } ${
                        theme === 'light'
                            ? 'border-stone-300 text-stone-700 bg-white hover:bg-wl-page'
                            : 'border-gray-300 text-gray-600 bg-white hover:bg-gray-50'
                    }`}
                >
                    {inviteBusy ? 'Creating…' : 'Copy invite'}
                </button>
                <button
                    type="button"
                    onClick={() => void handleJoin()}
                    disabled={joinBusy || isExpired}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1A3A4A] text-white hover:bg-[#15303d] transition-colors whitespace-nowrap disabled:cursor-wait disabled:opacity-80 ${
                        isExpired ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                    {joinBusy ? 'Joining…' : 'Join call'}
                </button>
            </div>
        </div>
    );

    if (!isEnded) {
        return <div className="flex flex-col">{statusBanner}</div>;
    }

    return (
        <div className="flex flex-col">
            {statusBanner}
            <div
                className={`my-2 mx-auto max-w-[480px] w-full rounded-xl border overflow-hidden ${
                    isDark
                        ? 'bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border-[#2a2a4a]'
                        : 'bg-white border-stone-200 shadow-sm'
                }`}
            >
                <div className={`w-full px-4 py-2 ${isDark ? 'border-[#2a2a4a]' : 'border-stone-200'}`}>
                    <button
                        type="button"
                        onClick={() => void loadTranscript()}
                        className={`w-full py-2 text-xs text-left font-medium rounded-md transition-colors ${
                            isDark
                                ? 'text-blue-400 hover:bg-[#1e2a44]'
                                : 'text-[#234C6A] hover:bg-stone-100'
                        }`}
                    >
                        {loading ? 'Loading...' : expanded ? '▼ Hide transcript' : '▶ Show meeting transcript'}
                    </button>
                    {canRate ? (
                        <div className="mt-2">
                            <div className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                {targetName ? `Rate ${targetName}` : 'Rate this call'}
                            </div>
                            {hasRated ? (
                                <div className={`mt-1 text-[11px] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                    Thanks, your rating was submitted.
                                </div>
                            ) : (
                                <div className="mt-1 space-y-2">
                                    <select
                                        value={score}
                                        onChange={(e) => setScore(Number(e.target.value))}
                                        className={`w-full rounded-md border px-2 py-1 text-xs ${
                                            isDark
                                                ? 'bg-slate-800 border-slate-600 text-slate-100'
                                                : 'bg-wl-page border-stone-300 text-wl-ink'
                                        }`}
                                    >
                                        {[5, 4, 3, 2, 1].map((n) => (
                                            <option key={n} value={n}>
                                                {n} / 5
                                            </option>
                                        ))}
                                    </select>
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="Optional feedback"
                                        rows={2}
                                        className={`w-full rounded-md border px-2 py-1 text-xs ${
                                            isDark
                                                ? 'bg-slate-800 border-slate-600 text-slate-100'
                                                : 'bg-wl-page border-stone-300 text-wl-ink'
                                        }`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => void handleRateSubmit()}
                                        disabled={submittingRating}
                                        className="rounded-md bg-[#234C6A] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                                    >
                                        {submittingRating ? 'Submitting...' : 'Submit rating'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={`mt-2 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {ratingBlockedReason || 'Rating is unavailable for this call.'}
                        </div>
                    )}
                </div>

                {expanded && transcript.length > 0 && (
                    <div
                        className={`px-4 pb-3 space-y-1.5 max-h-60 overflow-y-auto ${
                            isDark ? 'border-t border-[#2a2a4a]' : 'border-t border-stone-200'
                        }`}
                    >
                        {transcript.map((msg, i) => (
                            <div key={i} className="pt-1.5">
                                <span className={`text-xs font-semibold ${isDark ? 'text-blue-300' : 'text-[#234C6A]'}`}>
                                    {msg.authorName || msg.author?.username || 'Unknown'}
                                </span>
                                <span className={`text-xs ml-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                                    {msg.content}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {expanded && transcript.length === 0 && !loading && (
                    <div className={`px-4 py-2 text-xs ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                        No messages were sent during this meeting.
                    </div>
                )}
            </div>
        </div>
    );
};

export default MeetingCard;

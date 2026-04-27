import React, { useState, useEffect } from 'react';
import { createMeetingGuestInvite, getMeetingJoinInfo, getMeetingThread, getMeetingRatingState, submitMeetingRating } from '../api/chatApi';
import { ExternalLink, Video } from "lucide-react";

interface MeetingCardProps {
    meetingThreadId: string;
    jitsiRoomName: string;
    starterName: string;
    isEnded?: boolean;
    duration?: number;
    participantCount?: number;
    theme?: 'dark' | 'light';
    onJoin?: (jitsiUrl: string) => void;
}

const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
};

const MeetingCard: React.FC<MeetingCardProps> = ({
    meetingThreadId,
    jitsiRoomName,
    starterName,
    isEnded = false,
    duration = 0,
    participantCount = 0,
    theme = 'dark',
    onJoin,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [transcript, setTranscript] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [canRate, setCanRate] = useState(false);
    const [hasRated, setHasRated] = useState(false);
    const [ratingBlockedReason, setRatingBlockedReason] = useState<string>("");
    const [targetName, setTargetName] = useState<string>("");
    const [score, setScore] = useState<number>(5);
    const [comment, setComment] = useState("");
    const [submittingRating, setSubmittingRating] = useState(false);
    const [inviteBusy, setInviteBusy] = useState(false);
    const jitsiDomain = process.env.REACT_APP_JITSI_DOMAIN || 'meet.wisdomlinked.com';
    const fallbackJitsiUrl = `https://${jitsiDomain}/${jitsiRoomName}`;
    const handleJoin = async () => {
        const info = await getMeetingJoinInfo(meetingThreadId);
        if (info?.success && info?.jitsiUrl) {
            onJoin?.(info.jitsiUrl);
            return;
        }
        onJoin?.(fallbackJitsiUrl);
    };


    const loadTranscript = async () => {
        if (transcript.length > 0) {
            setExpanded(!expanded);
            return;
        }
        setLoading(true);
        const data = await getMeetingThread(meetingThreadId);
        if (data?.meeting?.transcript) {
            setTranscript(data.meeting.transcript);
        }
        setExpanded(true);
        setLoading(false);
    };

    const isDark = theme === 'dark';

    useEffect(() => {
        let cancelled = false;
        const loadRatingState = async () => {
            if (!isEnded || !meetingThreadId) return;
            const state = await getMeetingRatingState(meetingThreadId);
            if (cancelled) return;
            setCanRate(Boolean(state?.canRate));
            setRatingBlockedReason(String(state?.ratingBlockedReason || ""));
            setHasRated(Boolean(state?.hasRated));
            setTargetName(String(state?.targetUser?.username || ""));
            if (state?.existingRating?.score) setScore(Number(state.existingRating.score));
            if (typeof state?.existingRating?.comment === "string") {
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
            try {
                await navigator.clipboard.writeText(res.inviteUrl);
                // keep lightweight here; alert is sufficient for now
                window.alert('Guest invite link copied (valid up to 2 hours).');
            } catch {
                window.alert(res.inviteUrl);
            }
        } else {
            window.alert(res?.error || 'Could not create guest invite link');
        }
    };

    return (
        <div className={`my-2 mx-auto max-w-[480px] rounded-xl border overflow-hidden ${
            isDark
                ? 'bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border-[#2a2a4a]'
                : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
        }`}>
            {/* Header */}
            <div className={`px-4 py-3 flex items-center gap-3 ${
                isDark ? 'border-b border-[#2a2a4a]' : 'border-b border-blue-200'
            }`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${
                    isEnded
                        ? (isDark ? 'bg-gray-700' : 'bg-gray-200')
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                }`}>
                    <Video className={`h-4 w-4 ${isEnded ? (isDark ? "text-gray-300" : "text-gray-700") : "text-white"}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {isEnded ? 'WisdomLinked Meet ended' : 'WisdomLinked Meet in progress'}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        Started by {starterName}
                        {isEnded && duration > 0 && ` · ${formatDuration(duration)}`}
                        {isEnded && participantCount > 0 && ` · ${participantCount} participants`}
                    </div>
                </div>
                {!isEnded && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopyGuestInvite}
                            className="px-3 py-1.5 text-[11px] font-semibold rounded-full border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 transition-all"
                        >
                            {inviteBusy ? 'Creating…' : 'Copy guest invite'}
                        </button>
                        <button
                            onClick={() => void handleJoin()}
                            className="px-4 py-1.5 text-xs font-semibold rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:brightness-110 transition-all shadow-sm"
                        >
                            Join call
                        </button>
                    </div>
                )}
            </div>

            {jitsiRoomName ? (
                <div className={`px-4 py-2 text-xs flex items-center gap-1.5 ${isDark ? "text-blue-300" : "text-blue-700"}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    <a
                        href={fallbackJitsiUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:opacity-80"
                    >
                        WisdomLinked Meet
                    </a>
                </div>
            ) : null}

            {/* Transcript toggle */}
            {isEnded && (
                <div className={`w-full px-4 py-2 border-t ${isDark ? 'border-[#2a2a4a]' : 'border-blue-200'}`}>
                    <button
                        onClick={loadTranscript}
                        className={`w-full py-1 text-xs text-left transition-colors ${
                            isDark
                                ? 'text-blue-400 hover:bg-[#1e2a44]'
                                : 'text-blue-600 hover:bg-blue-100'
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
                                            isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                                        }`}
                                    >
                                        {[5, 4, 3, 2, 1].map((n) => (
                                            <option key={n} value={n}>{n} / 5</option>
                                        ))}
                                    </select>
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="Optional feedback"
                                        rows={2}
                                        className={`w-full rounded-md border px-2 py-1 text-xs ${
                                            isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                                        }`}
                                    />
                                    <button
                                        onClick={handleRateSubmit}
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
            )}

            {/* Transcript messages */}
            {expanded && transcript.length > 0 && (
                <div className={`px-4 pb-3 space-y-1.5 max-h-60 overflow-y-auto ${
                    isDark ? 'border-t border-[#2a2a4a]' : 'border-t border-blue-200'
                }`}>
                    {transcript.map((msg: any, i: number) => (
                        <div key={i} className="pt-1.5">
                            <span className={`text-xs font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                {msg.authorName || msg.author?.username || 'Unknown'}
                            </span>
                            <span className={`text-xs ml-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                                {msg.content}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {expanded && transcript.length === 0 && (
                <div className={`px-4 py-2 text-xs ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                    No messages were sent during this meeting.
                </div>
            )}
        </div>
    );
};

export default MeetingCard;
